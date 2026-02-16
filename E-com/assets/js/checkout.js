/**
 * Checkout Logic
 */

document.addEventListener('commonComponentsLoaded', () => {
    const client = window.supabase;
    const checkoutItems = document.getElementById('checkout-items');
    const subtotalEl = document.getElementById('summary-subtotal');
    const discountEl = document.getElementById('summary-discount');
    const discountRow = document.getElementById('discount-row');
    const totalEl = document.getElementById('summary-total');
    const couponInput = document.getElementById('coupon-code');
    const applyCouponBtn = document.getElementById('apply-coupon');
    const couponMsg = document.getElementById('coupon-msg');
    const placeOrderBtn = document.getElementById('place-order-btn');
    const checkoutForm = document.getElementById('checkout-form');

    // Address Elements
    const savedAddressesContainer = document.getElementById('saved-addresses-container');
    const savedAddressesList = document.getElementById('saved-addresses-list');
    const newAddressForm = document.getElementById('new-address-form');
    const checkoutAddressModalEl = document.getElementById('checkoutAddressModal');
    let checkoutAddressModal;
    if (checkoutAddressModalEl) {
        checkoutAddressModal = new bootstrap.Modal(checkoutAddressModalEl);
    }

    let appliedCoupon = null;
    let cart = [];
    let currentUser = null;

    // Data for India States and Districts (Copied from profile.js to avoid dependency issues)
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

    let modalStateSelect, modalCitySelect;

    async function init() {
        cart = window.CartManager.getCart();
        if (cart.length === 0) {
            window.location.href = 'cart.html';
            return;
        }

        // Get session
        const { data: { session } } = await client.auth.getSession();
        if (session) {
            currentUser = session.user;
            await loadSavedAddresses();
            initRegionDropdowns();
        } else {
            // If not logged in, just initialize without addresses
            // Or maybe prompt login? For now let's leave it as guest checkout capable
        }

        renderSummary();
        setupEventListeners();

        // Only prefill if no address selected yet (handled in loadSavedAddresses)
        if (!currentUser) {
            // Guest mode or no addresses - maybe try to load profile info if any?
        }
    }

    async function loadSavedAddresses() {
        if (!currentUser) return;

        try {
            const { data: addresses, error } = await client
                .from('user_addresses')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('is_default', { ascending: false });

            if (error) {
                console.error('Error fetching addresses:', error);
                return;
            }

            if (addresses && addresses.length > 0) {
                savedAddressesContainer.classList.remove('d-none');

                savedAddressesList.innerHTML = addresses.map((addr, index) => `
                    <div class="col-md-6">
                        <label class="payment-option h-100 align-items-start">
                            <input type="radio" name="selected_address" value="${addr.id}" 
                                class="mt-1 me-2" ${addr.is_default || index === 0 ? 'checked' : ''}
                                data-address='${JSON.stringify(addr).replace(/'/g, "&#39;")}'>
                            <div class="flex-grow-1">
                                <div class="fw-bold d-flex justify-content-between">
                                    ${addr.title}
                                    ${addr.is_default ? '<span class="badge bg-light text-primary border border-primary">Default</span>' : ''}
                                </div>
                                <div class="small text-muted mt-1">
                                    ${addr.address_line1}<br>
                                    ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}
                                    ${addr.city}, ${addr.state} - ${addr.pincode}
                                </div>
                                <div class="small text-muted mt-1">
                                    Mobile: ${currentUser.phone || addr.phone_secondary || 'N/A'}
                                </div>
                            </div>
                        </label>
                    </div>
                `).join('');

                // Add event listeners to radios
                document.querySelectorAll('input[name="selected_address"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        fillShippingForm(JSON.parse(e.target.dataset.address));
                    });
                });

                // Auto-fill the checked one
                const checkedRadio = document.querySelector('input[name="selected_address"]:checked');
                if (checkedRadio) {
                    fillShippingForm(JSON.parse(checkedRadio.dataset.address));
                }
            } else {
                // No addresses
                savedAddressesContainer.classList.remove('d-none');
                savedAddressesList.innerHTML = '<div class="col-12"><p class="text-danger">You have no saved addresses. Please add a new delivery address to proceed.</p></div>';

                // Try to prefill from profile even if no address selected (Name/Email)
                prefillUserInfo();
            }
        } catch (err) {
            console.error('Error loading addresses:', err);
        }
    }

    function fillShippingForm(address) {
        if (!address) return;
        const form = checkoutForm;

        // We might need first/last name from profile if not in address
        if (currentUser && currentUser.user_metadata) {
            const meta = currentUser.user_metadata;
            if (meta.first_name) form.first_name.value = meta.first_name;
            if (meta.last_name) form.last_name.value = meta.last_name;
            // Profile might have split name differently
        }
        // Or try to fetch profile name if we haven't already

        form.email.value = currentUser.email;

        // Address specific fields
        form.address.value = address.address_line1 + (address.address_line2 ? ', ' + address.address_line2 : '');
        form.city.value = address.city;
        form.state.value = address.state;
        form.pincode.value = address.pincode;

        // Use user phone or address phone
        if (address.phone_secondary) {
            form.phone.value = address.phone_secondary;
        } else if (currentUser.phone) {
            form.phone.value = currentUser.phone.replace('+91', '');
        }
    }

    async function prefillUserInfo() {
        if (!currentUser) return;

        const { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            const form = checkoutForm;
            if (profile.full_name) {
                const names = profile.full_name.split(' ');
                form.first_name.value = names[0] || '';
                form.last_name.value = names.length > 1 ? names.slice(1).join(' ') : '';
            }
            form.email.value = currentUser.email;
            if (profile.phone) form.phone.value = profile.phone.replace('+91', '');

            // If checking out without saved address, we don't have these, but let's see
        }
    }

    // --- Modal Logic ---

    function initRegionDropdowns() {
        const stateEl = document.getElementById('modal-state');
        const cityEl = document.getElementById('modal-city');

        if (!stateEl || !cityEl) return;

        // Populate Only Kerala as per requirement in previous tasks
        stateEl.innerHTML = '<option value="Kerala" selected>Kerala</option>';
        stateEl.disabled = true;

        // Populate Kerala Districts immediately
        updateDistricts("Kerala");

        // Initialize SlimSelect
        if (window.SlimSelect) {
            modalCitySelect = new SlimSelect({
                select: '#modal-city',
                settings: { placeholderText: 'Select District' }
            });

            modalStateSelect = new SlimSelect({
                select: '#modal-state',
                settings: { showSearch: false, disabled: true }
            });
        }

        // Address Form Submit
        if (newAddressForm) {
            newAddressForm.addEventListener('submit', handleNewAddress);
        }
    }

    function updateDistricts(stateName, selectedDistrict = '') {
        const cityEl = document.getElementById('modal-city');
        if (!cityEl) return;

        if (!stateName || !indiaData[stateName]) {
            cityEl.innerHTML = '<option value="">Select District</option>';
        } else {
            const districts = indiaData[stateName].sort();
            cityEl.innerHTML = '<option value="">Select District</option>' +
                districts.map(d => `<option value="${d}" ${d === selectedDistrict ? 'selected' : ''}>${d}</option>`).join('');
        }

        if (modalCitySelect) {
            modalCitySelect.setData(Array.from(cityEl.options).map(opt => ({ text: opt.text, value: opt.value, selected: opt.selected })));
        }
    }

    async function handleNewAddress(e) {
        e.preventDefault();
        const fd = new FormData(newAddressForm);
        const submitBtn = newAddressForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;

        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving...';

        try {
            const phone = fd.get('phone_secondary');
            const data = {
                user_id: currentUser.id,
                title: fd.get('title'),
                address_line1: fd.get('address_line1'),
                address_line2: fd.get('address_line2'),
                state: fd.get('state') || 'Kerala',
                city: fd.get('city'),
                pincode: fd.get('pincode'),
                phone_secondary: phone ? (!phone.startsWith('+91') ? '+91' + phone : phone) : null,
                is_default: fd.get('is_default') === 'on'
            };

            if (data.is_default) {
                await client.from('user_addresses').update({ is_default: false }).eq('user_id', currentUser.id);
            }

            const { error } = await client.from('user_addresses').insert([data]);
            if (error) throw error;

            // Close modal
            if (checkoutAddressModal) checkoutAddressModal.hide();
            newAddressForm.reset();
            // Reset dropdowns
            if (modalCitySelect) modalCitySelect.setSelected('');

            // Reload addresses
            await loadSavedAddresses();

        } catch (err) {
            console.error(err);
            alert('Error saving address: ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }


    function renderSummary() {
        let subtotal = 0;
        checkoutItems.innerHTML = cart.map(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            return `
                <div class="product-mini-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="flex-grow-1">
                        <div class="fw-bold small">${item.name}</div>
                        <div class="text-muted small">Qty: ${item.quantity} × ₹${item.price.toLocaleString()}</div>
                    </div>
                    <div class="fw-bold small">₹${itemTotal.toLocaleString()}</div>
                </div>
            `;
        }).join('');

        let discount = 0;
        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                discount = (subtotal * appliedCoupon.value) / 100;
            } else {
                discount = appliedCoupon.value;
            }
            // Cap discount at subtotal
            discount = Math.min(discount, subtotal);

            discountRow.classList.remove('d-none');
            discountEl.textContent = `-₹${discount.toLocaleString()}`;
        } else {
            discountRow.classList.add('d-none');
        }

        const total = subtotal - discount;
        subtotalEl.textContent = `₹${subtotal.toLocaleString()}`;
        totalEl.textContent = `₹${total.toLocaleString()}`;
    }

    function setupEventListeners() {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponInput.value.trim().toUpperCase();
            if (!code) return;

            applyCouponBtn.disabled = true;
            applyCouponBtn.textContent = '...';

            try {
                const { data: coupon, error } = await client
                    .from('coupons')
                    .select('*')
                    .eq('code', code)
                    .eq('status', 'active')
                    .maybeSingle();

                if (error || !coupon) {
                    showCouponError('Invalid or expired coupon code.');
                } else {
                    // Check validity dates
                    const now = new Date();
                    if (now < new Date(coupon.start_date) || now > new Date(coupon.end_date)) {
                        showCouponError('This coupon is not valid at this time.');
                        return;
                    }

                    // Check min purchase
                    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    if (coupon.min_purchase && subtotal < coupon.min_purchase) {
                        showCouponError(`Minimum purchase of ₹${coupon.min_purchase} required.`);
                        return;
                    }

                    // Check usage limit
                    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
                        showCouponError('This coupon has reached its usage limit.');
                        return;
                    }

                    appliedCoupon = coupon;
                    showCouponSuccess(`Coupon "${code}" applied successfully!`);
                    renderSummary();
                }
            } catch (err) {
                console.error('Coupon error:', err);
                showCouponError('Error verifying coupon.');
            } finally {
                applyCouponBtn.disabled = false;
                applyCouponBtn.textContent = 'Apply';
            }
        });

        placeOrderBtn.addEventListener('click', async () => {
            // Check if an address is selected
            const selectedAddress = document.querySelector('input[name="selected_address"]:checked');
            if (!selectedAddress) {
                alert('Please select a delivery address.');
                return;
            }

            // Since we rely on hidden inputs populated from saved address, we skip standard form validity for those fields
            // But we should check if payment method is selected (it's radio, so usually one is checked)

            placeOrderBtn.disabled = true;
            placeOrderBtn.textContent = 'Processing...';

            try {
                await processOrder();
            } catch (err) {
                console.error('Order error:', err);
                alert('An error occurred while placing your order: ' + err.message);
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = 'Place Order';
            }
        });

        // Payment option selection
        document.querySelectorAll('.payment-option').forEach(opt => {
            if (opt.querySelector('input[name="payment_method"]')) {
                opt.addEventListener('click', () => {
                    const radio = opt.querySelector('input');
                    if (radio.disabled) return;

                    // Remove active from other payment options
                    const container = opt.closest('.payment-options');
                    if (container) {
                        container.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
                    }
                    opt.classList.add('active');
                    radio.checked = true;
                });
            }
        });
    }

    async function processOrder() {
        const formData = new FormData(checkoutForm);
        const customerData = Object.fromEntries(formData.entries());

        // Ensure user is logged in for record
        const { data: { session } } = await client.auth.getSession();

        // 0. Stock Validation
        for (const item of cart) {
            const { data: product, error } = await client
                .from('products')
                .select('stock_quantity, name')
                .eq('id', item.id)
                .single();

            if (error || !product) {
                throw new Error(`Product "${item.name}" not found.`);
            }

            if (product.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for "${item.name}". Available: ${product.stock_quantity}, Requested: ${item.quantity}`);
            }
        }

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let discount = 0;
        if (appliedCoupon) {
            discount = appliedCoupon.type === 'percentage'
                ? (subtotal * appliedCoupon.value) / 100
                : appliedCoupon.value;
            discount = Math.min(discount, subtotal);
        }

        const total = subtotal - discount;

        // 1. Create Order
        const orderData = {
            user_id: session?.user?.id || null,
            customer_email: customerData.email,
            customer_first_name: customerData.first_name,
            customer_last_name: customerData.last_name,
            customer_phone: customerData.phone,
            shipping_address: customerData.address,
            shipping_city: customerData.city,
            shipping_state: customerData.state,
            shipping_pincode: customerData.pincode,
            subtotal: subtotal,
            discount_amount: discount,
            total_amount: total,
            coupon_id: appliedCoupon?.id || null,
            payment_method: customerData.payment_method,
            status: 'pending'
        };

        const { data: order, error: orderError } = await client
            .from('orders')
            .insert([orderData])
            .select()
            .single();

        if (orderError) throw orderError;

        // 2. Create Order Items
        const orderItems = cart.map(item => ({
            order_id: order.id,
            product_id: item.id,
            quantity: item.quantity,
            price_per_item: item.price,
            total_price: item.price * item.quantity
        }));

        const { error: itemsError } = await client
            .from('order_items')
            .insert(orderItems);

        if (itemsError) throw itemsError;

        // 3. Update Stock and Coupon Usage
        const updatePromises = [];

        // Decrease Stock Logic
        for (const item of cart) {
            try {
                // Fetch fresh stock again to be sure (optional but safer)
                const { data: product } = await client
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', item.id)
                    .single();

                if (product) {
                    const newStock = Math.max(0, product.stock_quantity - item.quantity);
                    updatePromises.push(
                        client.from('products')
                            .update({ stock_quantity: newStock })
                            .eq('id', item.id)
                    );
                }
            } catch (err) {
                console.error(`Failed to update stock for item ${item.id}`, err);
            }
        }

        if (appliedCoupon) {
            updatePromises.push(client.rpc('increment_coupon_usage', { coupon_id: appliedCoupon.id }));
        }

        await Promise.all(updatePromises);

        // 4. Success!
        window.CartManager.saveCart([]); // Clear cart
        alert('Order placed successfully! Order ID: #' + order.id.substring(0, 8));
        window.location.href = 'index.html'; // Or a success page
    }

    function showCouponError(msg) {
        couponMsg.className = 'small mt-2 text-danger';
        couponMsg.textContent = msg;
    }

    function showCouponSuccess(msg) {
        couponMsg.className = 'small mt-2 text-success';
        couponMsg.textContent = msg;
    }

    init();
});
