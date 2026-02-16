/**
 * Profile and Address Management Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    if (!client) return;

    // Elements
    const personalInfoForm = document.getElementById('personal-info-form');
    const addressForm = document.getElementById('address-form');
    const addressList = document.getElementById('address-list');
    const btnSaveProfile = document.getElementById('btn-save-profile');
    const addressModalEl = document.getElementById('addressModal');
    const addressModal = new bootstrap.Modal(addressModalEl);

    let currentUser = null;

    // Tab Logic
    const navLinks = document.querySelectorAll('.profile-nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) content.classList.add('active');
            });
        });
    });

    // Check Auth
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        window.location.href = 'auth/login.html';
        return;
    }
    currentUser = session.user;

    // Load Profile Data
    async function loadProfile() {
        const { data: profile, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('Error loading profile:', error);
            return;
        }

        if (profile) {
            document.getElementById('profile-name').value = profile.full_name || '';
            document.getElementById('profile-email').value = profile.email || currentUser.email;

            // Extract phone without +91 if present
            let phone = profile.phone || '';
            if (phone.startsWith('+91')) phone = phone.substring(3);
            document.getElementById('profile-phone').value = phone;
        } else {
            document.getElementById('profile-email').value = currentUser.email;
        }
    }

    // Save Profile
    personalInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const full_name = document.getElementById('profile-name').value;
        const phone = document.getElementById('profile-phone').value;
        const formattedPhone = phone ? `+91${phone}` : null;

        btnSaveProfile.disabled = true;
        btnSaveProfile.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const { error } = await client.from('profiles').upsert({
            id: currentUser.id,
            full_name,
            phone: formattedPhone,
            email: currentUser.email
        });

        if (error) {
            showAlert('Error updating profile: ' + error.message, 'error');
        } else {
            showAlert('Profile updated successfully!', 'success');
        }

        btnSaveProfile.disabled = false;
        btnSaveProfile.innerText = 'Save Changes';
    });

    // Address Management
    async function loadAddresses() {
        addressList.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';

        try {
            const { data: addresses, error } = await client
                .from('user_addresses')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    addressList.innerHTML = `
                        <div class="col-12 text-center py-4 text-muted">
                            <p>Address table not found. Please create the <code>user_addresses</code> table in your Supabase SQL Editor.</p>
                        </div>`;
                } else {
                    throw error;
                }
                return;
            }

            if (!addresses || addresses.length === 0) {
                addressList.innerHTML = '<div class="col-12 text-center py-4 text-muted">No addresses saved yet.</div>';
                return;
            }

            addressList.innerHTML = addresses.map(addr => `
                <div class="col-md-6">
                    <div class="address-card">
                        ${addr.is_default ? '<span class="badge bg-primary">Default</span>' : ''}
                        <h6 class="fw-bold mb-2">${addr.title}</h6>
                        <p class="small fw-bold mb-1">${addr.full_name || ''}</p>
                        <p class="small text-muted mb-1">${addr.address_line1}</p>
                        ${addr.address_line2 ? `<p class="small text-muted mb-1">${addr.address_line2}</p>` : ''}
                        <p class="small text-muted mb-2">${addr.city}, ${addr.state} - ${addr.pincode}</p>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-dark px-3" onclick="editAddress('${addr.id}')">Edit</button>
                            <button class="btn btn-sm btn-outline-danger px-3" onclick="deleteAddress('${addr.id}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error loading addresses:', err);
            addressList.innerHTML = `<div class="col-12 text-center py-4 text-danger">Failed to load addresses: ${err.message}</div>`;
        }
    }

    // Save Address
    addressForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('address-id').value;
        const full_name = document.getElementById('address-name').value;
        const title = document.getElementById('address-title').value;
        const address_line1 = document.getElementById('address-line1').value;
        const address_line2 = document.getElementById('address-line2').value;
        const city = document.getElementById('address-city').value;
        const state = document.getElementById('address-state').value || 'Kerala';
        const pincode = document.getElementById('address-pincode').value;
        const phone_secondary = document.getElementById('address-phone-secondary').value;
        const is_default = document.getElementById('address-default').checked;

        const formattedPhoneSecondary = phone_secondary ? `+91${phone_secondary}` : null;

        const btnSave = document.getElementById('btn-save-address');
        const originalText = btnSave.innerText;
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            // If setting as default, unset others first
            if (is_default) {
                await client
                    .from('user_addresses')
                    .update({ is_default: false })
                    .eq('user_id', currentUser.id);
            }

            const addrData = {
                user_id: currentUser.id,
                full_name,
                title,
                address_line1,
                address_line2,
                city,
                state,
                pincode,
                phone_secondary: formattedPhoneSecondary,
                is_default
            };

            let error;
            if (id) {
                const { error: err } = await client.from('user_addresses').update(addrData).eq('id', id);
                error = err;
            } else {
                const { error: err } = await client.from('user_addresses').insert([addrData]);
                error = err;
            }

            if (error) throw error;

            addressModal.hide();
            loadAddresses();
        } catch (err) {
            showAlert('Error saving address: ' + err.message, 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = originalText;
        }
    });

    // Edit/Delete Globals
    window.editAddress = async (id) => {
        const { data: addr, error } = await client.from('user_addresses').select('*').eq('id', id).single();
        if (error) {
            showAlert('Error fetching address: ' + error.message, 'error');
            return;
        }

        document.getElementById('address-id').value = addr.id;
        document.getElementById('address-name').value = addr.full_name || '';
        document.getElementById('address-title').value = addr.title;
        document.getElementById('address-line1').value = addr.address_line1;
        document.getElementById('address-line2').value = addr.address_line2 || '';

        // Update State first
        if (stateSelect) {
            stateSelect.setSelected(addr.state);
        } else {
            document.getElementById('address-state').value = addr.state;
        }

        // Populate Districts and select the right one
        updateDistricts(addr.state, addr.city);

        document.getElementById('address-pincode').value = addr.pincode;

        // Extract secondary phone without +91 if present
        let secPhone = addr.phone_secondary || '';
        if (secPhone.startsWith('+91')) secPhone = secPhone.substring(3);
        document.getElementById('address-phone-secondary').value = secPhone;

        document.getElementById('address-default').checked = addr.is_default;

        document.querySelector('#addressModal .modal-title').innerText = 'Edit Address';
        addressModal.show();
    };

    window.deleteAddress = (id) => {
        showConfirm('Are you sure you want to delete this address?', async () => {
            const { error } = await client.from('user_addresses').delete().eq('id', id);
            if (error) {
                showAlert('Error deleting address: ' + error.message, 'error');
            } else {
                loadAddresses();
            }
        });
    };

    // Reset modal on close
    addressModalEl.addEventListener('hidden.bs.modal', () => {
        addressForm.reset();
        document.getElementById('address-id').value = '';
        document.querySelector('#addressModal .modal-title').innerText = 'Add New Address';

        // Reset SlimSelect to Kerala
        if (stateSelect) stateSelect.setSelected('Kerala');
        updateDistricts('Kerala');

        if (citySelect) {
            citySelect.setSelected('');
        }
    });

    // Data for India States and Districts
    const indiaData = {
        "Andaman and Nicobar Islands": ["Port Blair", "Nicobar", "North and Middle Andaman", "South Andaman"],
        "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa", "Nellore"],
        "Arunachal Pradesh": ["Tawang", "West Kameng", "East Kameng", "Papum Pare", "Kurung Kumey", "Kra Daadi", "Lower Subansiri", "Upper Subansiri", "West Siang", "East Siang", "Siang", "Upper Siang", "Lower Siang", "Lower Dibang Valley", "Upper Dibang Valley", "Anjaw", "Lohit", "Namsai", "Changlang", "Tirap", "Longding"],
        "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup Metropolitan", "Kamrup", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Dima Hasao", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
        "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
        "Chandigarh": ["Chandigarh"],
        "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja"],
        "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
        "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
        "Goa": ["North Goa", "South Goa"],
        "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udepur", "Dahod", "Dang", "Devbhumi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
        "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
        "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
        "Jammu and Kashmir": ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
        "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"],
        "Karnataka": ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"],
        "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Trissur", "Wayanad"],
        "Ladakh": ["Kargil", "Leh"],
        "Lakshadweep": ["Lakshadweep"],
        "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
        "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
        "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
        "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
        "Mizoram": ["Aizawl", "Champhai", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Serchhip"],
        "Nagaland": ["Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Peren", "Phek", "Tuensang", "Wokha", "Zunheboto"],
        "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Baudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Sonepur", "Sundargarh"],
        "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
        "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"],
        "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
        "Sikkim": ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim"],
        "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
        "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal Rural", "Warangal Urban", "Yadadri Bhuvanagiri"],
        "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
        "Uttar Pradesh": ["Agra", "Aligarh", "Allahabad", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Faizabad", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
        "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
        "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Medinipur", "Paschim Bardhaman", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
    };

    let stateSelect, citySelect;

    function initRegionDropdowns() {
        const stateEl = document.getElementById('address-state');
        const cityEl = document.getElementById('address-city');

        if (!stateEl || !cityEl) return;

        // Populate Only Kerala
        stateEl.innerHTML = '<option value="Kerala" selected>Kerala</option>';
        stateEl.disabled = true; // Rigidly set to Kerala

        // Populate Kerala Districts immediately
        updateDistricts("Kerala");

        // Initialize SlimSelect for District only
        if (window.SlimSelect) {
            citySelect = new SlimSelect({
                select: '#address-city',
                settings: { placeholderText: 'Select District' }
            });

            // State SlimSelect (optional, but for styling consistency)
            stateSelect = new SlimSelect({
                select: '#address-state',
                settings: { showSearch: false, disabled: true }
            });
        }
    }

    function updateDistricts(stateName, selectedDistrict = '') {
        const cityEl = document.getElementById('address-city');
        if (!cityEl) return;

        if (!stateName || !indiaData[stateName]) {
            cityEl.innerHTML = '<option value="">Select District</option>';
        } else {
            const districts = indiaData[stateName].sort();
            cityEl.innerHTML = '<option value="">Select District</option>' +
                districts.map(d => `<option value="${d}" ${d === selectedDistrict ? 'selected' : ''}>${d}</option>`).join('');
        }

        if (citySelect) {
            citySelect.setData(Array.from(cityEl.options).map(opt => ({ text: opt.text, value: opt.value, selected: opt.selected })));
        }
    }



    // --- Order History & Tracking ---

    async function loadOrders() {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        try {
            const { data: orders, error } = await client
                .from('orders')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch Returns for this user to display status on cards
            const { data: userReturns, error: returnError } = await client
                .from('returns')
                .select('order_id, status')
                .eq('user_id', currentUser.id);

            const orderReturnMap = {};
            if (userReturns) {
                userReturns.forEach(r => {
                    if (!orderReturnMap[r.order_id]) orderReturnMap[r.order_id] = [];
                    orderReturnMap[r.order_id].push(r.status);
                });
            }

            if (!orders || orders.length === 0) {
                ordersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="flaticon-shopping-bag mb-3 d-block" style="font-size: 3rem; color: #ddd;"></i>
                        <h4>No Orders Yet</h4>
                        <p class="text-muted">You haven't placed any orders yet. Start shopping to see your orders here!</p>
                        <a href="shop.html" class="ul-btn mt-3">Go to Shop</a>
                    </div>
                `;
                return;
            }

            ordersList.innerHTML = orders.map(order => {
                const date = new Date(order.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });

                let statusColor = 'secondary';
                if (order.status === 'pending') statusColor = 'warning';
                else if (order.status === 'processing') statusColor = 'info';
                else if (order.status === 'shipped') statusColor = 'primary';
                else if (order.status === 'delivered') statusColor = 'success';
                else if (order.status === 'cancelled') statusColor = 'danger';

                // Determine return label
                let returnLabel = '';
                const existingReturns = orderReturnMap[order.id];
                if (existingReturns && existingReturns.length > 0) {
                    if (existingReturns.includes('approved')) {
                        returnLabel = '<span class="badge bg-success ms-2">Return Approved</span>';
                    } else if (existingReturns.includes('pending')) {
                        returnLabel = '<span class="badge bg-warning text-dark ms-2">Return Pending</span>';
                    } else if (existingReturns.includes('refunded')) { // check if refunded logic exists
                        returnLabel = '<span class="badge bg-info ms-2">Refunded</span>';
                    } else if (existingReturns.includes('rejected')) {
                        returnLabel = '<span class="badge bg-danger ms-2">Return Rejected</span>';
                    } else {
                        // Default fallback
                        returnLabel = `<span class="badge bg-secondary ms-2">Return: ${existingReturns[0]}</span>`;
                    }
                }

                // Connect Cancel Button
                let cancelBtn = '';
                if (order.status === 'pending') {
                    cancelBtn = `<button class="btn btn-outline-danger btn-sm me-2" onclick="cancelOrder('${order.id}')">Cancel Order</button>`;
                }

                return `
                    <div class="card mb-3 border shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <span class="fw-bold">Order #${order.id.substring(0, 8)}</span>
                                    <span class="text-muted small ms-2">${date}</span>
                                    ${returnLabel}
                                </div>
                                <span class="badge bg-${statusColor} text-uppercase">${order.status}</span>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="small text-muted">Total Amount</div>
                                    <div class="fw-bold">₹${order.total_amount.toLocaleString('en-IN')}</div>
                                </div>
                                <div>
                                    ${cancelBtn}
                                    <button class="btn btn-outline-dark btn-sm" onclick="viewOrderTracking('${order.id}')">
                                        Track Order
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error('Error loading orders:', err);
            ordersList.innerHTML = '<div class="text-center text-danger py-4">Failed to load orders.</div>';
        }
    }

    // Cancel Order function
    window.cancelOrder = (orderId) => {
        showConfirm('Are you sure you want to cancel this order? This action cannot be undone.', async () => {
            try {
                // First check if it's still pending (double check)
                const { data: order, error: fetchError } = await client
                    .from('orders')
                    .select('status')
                    .eq('id', orderId)
                    .single();

                if (fetchError) throw fetchError;

                if (order.status !== 'pending') {
                    showAlert('This order cannot be cancelled because it is no longer pending.', 'warning');
                    loadOrders(); // Refresh to show new status
                    return;
                }

                // Restore stock before cancelling
                const { data: items, error: itemsError } = await client
                    .from('order_items')
                    .select('product_id, quantity')
                    .eq('order_id', orderId);

                if (itemsError) throw itemsError;

                if (items && items.length > 0) {
                    for (const item of items) {
                        // Fetch current stock
                        const { data: product, error: prodError } = await client
                            .from('products')
                            .select('stock_quantity')
                            .eq('id', item.product_id)
                            .single();

                        if (!prodError && product) {
                            const newStock = (product.stock_quantity || 0) + item.quantity;
                            await client
                                .from('products')
                                .update({ stock_quantity: newStock })
                                .eq('id', item.product_id);
                        }
                    }
                }

                const { error } = await client
                    .from('orders')
                    .update({ status: 'cancelled' })
                    .eq('id', orderId)
                    .eq('status', 'pending');

                if (error) throw error;

                showAlert('Order cancelled successfully.', 'success');
                loadOrders(); // Refresh the list
            } catch (err) {
                console.error('Error cancelling order:', err);
                showAlert('Failed to cancel order: ' + err.message, 'error');
            }
        });
    };

    // Global Tracking Function
    window.viewOrderTracking = async (orderId) => {
        const trackingModal = new bootstrap.Modal(document.getElementById('trackingModal'));

        // Reset/Loading state
        document.getElementById('track-order-id').innerText = '#' + orderId.substring(0, 8);
        document.getElementById('track-items-list').innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
        document.getElementById('track-courier-info').classList.add('d-none');

        trackingModal.show();

        try {
            // Fetch Order & Items
            const { data: order, error: orderError } = await client
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError) throw orderError;

            // Fetch profile separately for phone fallback
            let profile = null;
            if (order.user_id) {
                const { data: p } = await client
                    .from('profiles')
                    .select('phone')
                    .eq('id', order.user_id)
                    .single();
                profile = p;
            }

            const { data: items, error: itemsError } = await client
                .from('order_items')
                .select('*, products(name, images)')
                .eq('order_id', orderId);

            if (itemsError) throw itemsError;

            // Update Status UI
            updateTrackingProgress(order.status);

            // Render Details
            document.getElementById('track-total').innerText = '₹' + order.total_amount.toLocaleString('en-IN');

            document.getElementById('track-address').innerHTML = `
                <div class="fw-bold text-dark mb-1">${(order.customer_first_name || '') + ' ' + (order.customer_last_name || '')}</div>
                <div class="mb-1">${order.shipping_address}</div>
                <div>${order.shipping_city}, ${order.shipping_state} - ${order.shipping_pincode}</div>
                <div class="mt-1">Phone: ${order.customer_phone || (profile ? profile.phone : 'N/A')}</div>
            `;

            document.getElementById('track-payment').innerText = order.payment_method ? order.payment_method.replace('_', ' ').toUpperCase() : 'N/A';

            // Show Shipment Details if Shipped
            if (['shipped', 'out_for_delivery', 'delivered'].includes(order.status) && (order.courier_name || order.tracking_number)) {
                document.getElementById('track-courier-info').classList.remove('d-none');
                document.getElementById('track-courier-name').innerText = order.courier_name || 'N/A';
                document.getElementById('track-number').innerText = order.tracking_number || 'N/A';
            } else {
                document.getElementById('track-courier-info').classList.add('d-none');
            }

            // Items
            // Check Return Eligibility (Delivered + 1 Day)
            let isReturnable = false;

            if (order.status && order.status.toLowerCase() === 'delivered') {
                const deliveryDate = new Date(order.updated_at);

                const deadline = new Date(deliveryDate);
                deadline.setHours(23, 59, 59, 999); // End of delivery day
                deadline.setDate(deadline.getDate() + 1); // Add 1 day

                const now = new Date();
                if (now <= deadline) {
                    isReturnable = true;
                }
            }

            // Fetch Returns for this order
            const { data: returns, error: returnsError } = await client
                .from('returns')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true }); // Ensure latest return for item wins

            if (returnsError) {
                console.error("Error fetching returns:", returnsError);
            }

            // Create a map for quick lookup
            const returnsMap = {};
            if (returns) {
                returns.forEach(r => {
                    returnsMap[r.order_item_id] = r;
                });
            }

            document.getElementById('track-items-list').innerHTML = items.map(item => {
                const product = item.products;
                let img = '../assets/img/product-placeholder.png';
                if (product && product.images) {
                    try {
                        const parsed = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
                        if (Array.isArray(parsed) && parsed.length > 0) img = parsed[0];
                        else if (typeof parsed === 'string') img = parsed;
                    } catch (e) { }
                }

                // Check if this item has a return
                const returnData = returnsMap[item.id];
                let returnStatusHtml = '';
                let showReturnButton = isReturnable; // Start with base logic

                if (returnData) {
                    // Item has an existing return request
                    showReturnButton = false; // Never show return button if already returned/requested

                    let badgeClass = 'bg-secondary';
                    let statusText = returnData.status;

                    if (statusText === 'approved') badgeClass = 'bg-success';
                    else if (statusText === 'rejected') badgeClass = 'bg-danger';
                    else if (statusText === 'pending') badgeClass = 'bg-warning text-dark';

                    returnStatusHtml = `<div class="mt-1"><span class="badge ${badgeClass} text-uppercase" style="font-size: 0.7rem;">Return: ${statusText}</span></div>`;

                    if (statusText === 'rejected' && returnData.admin_notes) {
                        returnStatusHtml += `<div class="text-danger small mt-1" style="font-size: 0.75rem;"><strong>Reason:</strong> ${returnData.admin_notes}</div>`;
                    }
                }

                return `
                    <div class="d-flex align-items-center mb-3">
                        <img src="${img}" class="rounded me-3" style="width: 50px; height: 50px; object-fit: cover;" onerror="this.src='assets/img/logo.png'">
                        <div class="flex-grow-1">
                            <div class="fw-bold small two-line-clamp">${product ? product.name : 'Product Unavailable'}</div>
                            <div class="text-muted small">Qty: ${item.quantity} x ₹${item.price_per_item.toLocaleString()}</div>
                            ${returnStatusHtml}
                        </div>
                        <div class="text-end">
                            <div class="fw-bold">₹${item.total_price.toLocaleString()}</div>
                            ${showReturnButton ? `<button class="btn btn-sm btn-outline-danger mt-1" style="font-size: 0.7rem; padding: 2px 6px;" onclick="initiateReturn('${orderId}', '${item.id}')">Return</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error(err);
            showAlert('Failed to load tracking details', 'error');
            trackingModal.hide();
        }
    };

    function updateTrackingProgress(status) {
        const steps = ['pending', 'processing', 'shipped', 'out', 'delivered'];
        // Map backend status to steps
        // Backend: pending, processing, shipped, delivered, cancelled
        // 'out' is hypothetical 'out_for_delivery' if you have it, else we map accordingly

        let activeIndex = -1;
        if (status === 'pending') activeIndex = 0;
        else if (status === 'processing') activeIndex = 1;
        else if (status === 'shipped') activeIndex = 2;
        else if (status === 'out_for_delivery') activeIndex = 3;
        else if (status === 'delivered') activeIndex = 4;

        // Progress Bar Width
        const progressMap = [0, 25, 50, 75, 100];
        const width = activeIndex >= 0 ? progressMap[activeIndex] : 0;
        document.getElementById('track-progress-bar').style.width = width + '%';

        // Status Badge
        const badgeEl = document.getElementById('track-status-badge');
        if (status === 'cancelled') {
            badgeEl.innerHTML = '<span class="badge bg-danger fs-6 w-100">Order Cancelled</span>';
            document.getElementById('track-progress-bar').className = 'progress-bar bg-danger';
        } else if (status === 'delivery_failed') {
            badgeEl.innerHTML = '<span class="badge bg-danger fs-6 w-100">Delivery Failed - Returning to Supplier</span>';
            document.getElementById('track-progress-bar').className = 'progress-bar bg-warning'; // or danger
            // Maybe set width to shipped or something?
        } else if (status === 'return_replacement') {
            badgeEl.innerHTML = '<span class="badge bg-info fs-6 w-100">Return Accepted: Replacement Initiated</span>';
            // Progress bar? maybe reset or full?
        } else if (status === 'return_refund') {
            badgeEl.innerHTML = '<span class="badge bg-info fs-6 w-100">Return Accepted: Refund Initiated</span>';
        } else {
            badgeEl.innerHTML = '';
            document.getElementById('track-progress-bar').className = 'progress-bar';
        }

        // Steps Styling
        steps.forEach((step, index) => {
            const el = document.getElementById(`step-${step}`);
            if (!el) return;

            if (status === 'cancelled') {
                el.classList.remove('btn-primary', 'btn-secondary');
                el.classList.add('btn-secondary');
                return;
            }

            if (index <= activeIndex) {
                el.classList.remove('btn-secondary');
                el.classList.add('btn-primary');
            }
        });
    }

    // Initiate Return
    window.initiateReturn = async (orderId, itemId) => {
        // Create modal dynamically if not exists
        if (!document.getElementById('returnModal')) {
            const modalHtml = `
                <div class="modal fade" id="returnModal" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Return Item</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="return-form">
                                    <input type="hidden" id="return-order-id">
                                    <input type="hidden" id="return-item-id">
                                    <div class="mb-3">
                                        <label class="form-label">Reason for Return</label>
                                        <select class="form-select" id="return-reason" required>
                                            <option value="">Select a reason</option>
                                            <option value="Defective product">Defective product</option>
                                            <option value="Wrong item sent">Wrong item sent</option>
                                            <option value="Item arrived damaged">Item arrived damaged</option>
                                            <option value="Product not as described">Product not as described</option>
                                            <option value="Size issue">Size issue</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Additional Comments</label>
                                        <textarea class="form-control" id="return-comments" rows="3"></textarea>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-danger" id="btn-submit-return">Submit Return</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Add event listener for submit
            document.getElementById('btn-submit-return').addEventListener('click', async () => {
                const btn = document.getElementById('btn-submit-return');
                const orderId = document.getElementById('return-order-id').value;
                const itemId = document.getElementById('return-item-id').value;
                const reasonSelect = document.getElementById('return-reason');
                const reason = reasonSelect.value;
                const comments = document.getElementById('return-comments').value;

                if (!reason) {
                    showAlert('Please select a reason for return.', 'warning');
                    return;
                }

                const fullReason = comments ? `${reason} - ${comments}` : reason;

                btn.disabled = true;
                btn.innerText = 'Submitting...';

                console.log('Submitting return payload:', {
                    order_id: orderId,
                    order_item_id: itemId,
                    user_id: currentUser.id,
                    reason: fullReason,
                    status: 'pending'
                });

                try {
                    const { error } = await client.from('returns').insert({
                        order_id: orderId,
                        order_item_id: itemId,
                        user_id: currentUser.id,
                        reason: fullReason,
                        status: 'pending'
                    });

                    if (error) throw error;

                    showAlert('Return request has been submitted successfully. We will review it shortly.', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('returnModal')).hide();

                    // Optional: Refresh orders or hide button?
                    // For now, reload orders might be overkill, but let's just close modal.
                } catch (err) {
                    console.error('Error submitting return:', err);
                    showAlert('Failed to submit return request: ' + err.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Submit Return';
                }
            });
        }

        document.getElementById('return-order-id').value = orderId;
        document.getElementById('return-item-id').value = itemId;
        document.getElementById('return-reason').value = '';
        document.getElementById('return-comments').value = '';

        new bootstrap.Modal(document.getElementById('returnModal')).show();
    };

    // Init
    loadProfile();
    loadAddresses();
    loadOrders();
    initRegionDropdowns();

    // Check for tab query param
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const targetLink = document.querySelector(`.profile-nav-link[data-tab="${tabParam}"]`);
        if (targetLink) {
            targetLink.click();
        }
    }
});

