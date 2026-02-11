(function () {
    const SUPABASE_URL = 'https://rcmeifutgontewyycivi.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_aJ9CPJVCp3cM1lUVrjOKFA_Yrx-jDe4';

    window.supabaseAdmin = (typeof window.supabase !== 'undefined')
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;
    const supabaseAdmin = window.supabaseAdmin;

    document.addEventListener('DOMContentLoaded', async () => {
        console.log('Admin JS Loaded - Prioritizing Sidebar');

        // 1. Try Load Sidebar & Modal immediately
        try {
            await loadAdminSidebar();
        } catch (err) {
            console.error('Sidebar error:', err);
        }

        const authOverlay = document.getElementById('auth-overlay');

        if (!supabaseAdmin) {
            console.error('Supabase not initialized');
            return;
        }

        try {
            // Check Authentication
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser();

            if (authError || !user) {
                console.log('Auth failed or no user', authError);
                if (authOverlay) authOverlay.style.visibility = 'visible';
                return;
            }

            console.log('User authenticated:', user.email);
            const emailSpan = document.getElementById('admin-email');
            if (emailSpan) emailSpan.textContent = user.email;

            // Initialize Dashboard/Data
            if (document.getElementById('stat-total')) loadStats();
            if (document.getElementById('participantsList')) loadParticipants();
            if (document.getElementById('collegesList')) loadColleges();

            // Search listener for participants page
            const participantSearch = document.getElementById('participantSearch');
            if (participantSearch) {
                participantSearch.addEventListener('input', () => {
                    if (typeof filterParticipants === 'function') {
                        filterParticipants();
                    }
                });
            }

            document.addEventListener('click', async (e) => {
                if (e.target && e.target.id === 'admin-logout') {
                    e.preventDefault();
                    await supabaseAdmin.auth.signOut();
                    window.location.href = 'login.html';
                }
            });
        } catch (err) {
            console.error('Initial load error:', err);
        }
    });

    async function loadAdminSidebar() {
        console.log('Loading sidebar...');
        const sidebarContainer = document.getElementById('sidebar-container');
        if (!sidebarContainer) {
            console.error('Sidebar container not found');
            return;
        }

        const sidebarHTML = `
            <div class="admin-sidebar" id="sidebar-nav">
                <h2>
                    <button class="mobile-toggle" onclick="toggleAdminSidebar()" style="display: none; background: none; border: none; cursor: pointer; color: var(--admin-text); padding: 0.5rem; margin-left: -0.5rem;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <span class="logo-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </span>
                    MGUPC Admin
                </h2>
                <ul class="admin-nav">
                    <li>
                        <a href="index.html" id="nav-dashboard">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            </span> 
                            Dashboard
                        </a>
                    </li>
                    <li>
                        <a href="participants.html" id="nav-participants">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="19" cy="11" r="2"/></svg>
                            </span> 
                            Registrations
                        </a>
                    </li>
                    <li>
                        <a href="colleges.html" id="nav-colleges">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
                            </span> 
                            Colleges
                        </a>
                    </li>
                    <li>
                        <a href="users.html" id="nav-users">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </span> 
                            Users
                        </a>
                    </li>
                    <li>
                        <a href="announcements.html" id="nav-announcements">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                            </span> 
                            Announcements
                        </a>
                    </li>
                    <li>
                        <a href="sponsors.html" id="nav-sponsors">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                    <rect width="18" height="12" x="3" y="6" rx="2" ry="2"/>
                                    <path d="M3 10h18"/>
                                </svg>
                            </span> 
                            Sponsors
                        </a>
                    </li>
                    <li>
                        <a href="categories.html" id="nav-categories">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
                                </svg>
                            </span> 
                            Categories
                        </a>
                    </li>
                    <li>
                        <a href="verification-setup.html" id="nav-verification-setup">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                </svg>
                            </span> 
                            Verification - setup
                        </a>
                    </li>
                    <li>
                        <a href="verification.html" id="nav-verification">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                            </span> 
                            Verification
                        </a>
                    </li>
                    <li>
                        <a href="live-scoring.html" id="nav-live-scoring">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                    <path d="M12 22v-5"/>
                                    <path d="M8 12h8"/>
                                </svg>
                            </span> 
                            Live Scoring
                        </a>
                    </li>
                    <li>
                        <a href="../index.html">
                            <span class="nav-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            </span> 
                            View Site
                        </a>
                    </li>
                </ul>
                <div class="admin-logout-section">
                    <a href="#" id="admin-logout">
                        <span class="nav-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                        </span> 
                        Logout
                    </a>
                </div>
            </div>
        `;

        sidebarContainer.innerHTML = sidebarHTML;

        // --- GLOBAL MODAL INJECTION ---
        // Robust injection: Check for modal AND essential sub-elements
        const existingModal = document.getElementById('adminModal');
        const isUpToDate = existingModal && document.getElementById('modal-error');

        if (!isUpToDate) {
            if (existingModal) existingModal.remove(); // Remove legacy version if it exists

            const modalHTML = `
                <div id="adminModal" class="modal-overlay">
                    <div class="modal-card">
                        <h3 id="modalTitle">Notification</h3>
                        <p id="modalMessage"></p>
                        
                        <div id="modalInputContainer" style="display: none; margin-bottom: 1rem;">
                            <input type="text" id="modalInput" class="modal-input">
                        </div>

                        <div id="mathChallengeBox" class="math-challenge" style="display: none;">
                            <label id="mathExpression"></label>
                            <input type="number" id="mathAnswer" class="modal-input" placeholder="Your Answer" style="margin-bottom: 0;">
                        </div>

                        <div id="modal-error" style="color: #f87171; font-size: 0.85rem; margin-bottom: 1rem; display: none; text-align: center; font-weight: 600;"></div>

                        <div class="modal-actions">
                            <button id="modalCancelBtn" class="btn-cancel" onclick="closeAdminModal()">Cancel</button>
                            <button id="modalConfirmBtn" class="btn-confirm">OK</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // --- Participant Details Modal Injection ---
        if (!document.getElementById('participantDetailsModal')) {
            const detailsModalHTML = `
                <div id="participantDetailsModal" class="modal-overlay">
                    <div class="modal-card" style="max-width: 500px; padding: 1.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="margin: 0;">Participant Profile</h3>
                            <button onclick="closeDetailsModal()" style="background: none; border: none; cursor: pointer; color: #6b7280;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div id="participantDetailsContent"></div>
                        <div class="modal-actions" style="margin-top: 2rem;">
                            <button class="btn-cancel" onclick="closeDetailsModal()">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', detailsModalHTML);
        }

        console.log('Sidebar & Modal injected');
        highlightActiveAdminLink();

        // Add Mobile Toggle Button to Admin Header if it exists
        const header = document.querySelector('.admin-header');
        if (header && !document.getElementById('mobile-menu-trigger')) {
            const trigger = `
                <button id="mobile-menu-trigger" onclick="toggleAdminSidebar()" class="btn" style="display: none; padding: 0.5rem; background: #f3f4f6; color: #374151; margin-right: 1rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
            `;
            header.insertAdjacentHTML('afterbegin', trigger);
        }
    }

    window.toggleAdminSidebar = () => {
        const sidebar = document.getElementById('sidebar-nav');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    };

    function highlightActiveAdminLink() {
        const path = window.location.pathname.split("/").pop() || 'index.html';
        const navIdMap = {
            'index.html': 'nav-dashboard',
            'participants.html': 'nav-participants',
            'colleges.html': 'nav-colleges',
            'users.html': 'nav-users',
            'announcements.html': 'nav-announcements',
            'sponsors.html': 'nav-sponsors',
            'categories.html': 'nav-categories',
            'verification-setup.html': 'nav-verification-setup',
            'verification.html': 'nav-verification',
            'matches.html': 'nav-matches',
            'matches.html': 'nav-matches',
            'add-match.html': 'nav-add-match',
            'live-scoring.html': 'nav-live-scoring'
        };

        const activeId = navIdMap[path];
        if (activeId) {
            const activeLink = document.getElementById(activeId);
            if (activeLink) {
                document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
                activeLink.classList.add('active');
            }
        }
    }

    async function loadStats() {
        const { data, error } = await supabaseAdmin
            .from('participants')
            .select('*');

        if (error) {
            console.error('Error loading stats:', error);
            return;
        }

        const total = data.length;
        const men = data.filter(p => p.gender === 'Male').length;
        const women = data.filter(p => p.gender === 'Female').length;
        const colleges = new Set(data.map(p => p.college_name)).size;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal('stat-total', total);
        setVal('stat-men', men);
        setVal('stat-women', women);
        setVal('stat-colleges', colleges);
    }

    async function loadParticipants() {
        // Fetch participants and colleges in parallel
        const [participantsRes, collegesRes] = await Promise.all([
            supabaseAdmin.from('participants').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('colleges').select('name')
        ]);

        const { data, error } = participantsRes;
        if (error) {
            const tbody = document.getElementById('participantsList');
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
            return;
        }

        // Store data globally
        window.officialColleges = new Set((collegesRes.data || []).map(c => c.name));
        window.allParticipants = data || [];

        renderParticipants(window.allParticipants);
    }

    window.renderParticipants = function (data) {
        const tbody = document.getElementById('participantsList');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No participants found.</td></tr>';
            return;
        }

        const isDashboard = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/admin/') || window.location.pathname.endsWith('/admin');
        const officialColleges = window.officialColleges || new Set();

        tbody.innerHTML = data.map(p => {
            // Priority: Calculate fresh age from DOB for immediate reflection on edits
            let displayAge = null;
            if (p.dob) {
                const dob = new Date(p.dob);
                const cutoff = new Date('2025-07-01');
                displayAge = cutoff.getFullYear() - dob.getFullYear();
                const m = cutoff.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && cutoff.getDate() < dob.getDate())) {
                    displayAge--;
                }
            } else {
                displayAge = p.age;
            }

            const isUnofficial = !officialColleges.has(p.college_name);
            const collegeDisplay = isUnofficial
                ? `<span style="background: #fff7ed; color: #c2410c; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; border: 1px solid #ffedd5; display: inline-flex; align-items: center; gap: 4px;" title="Unofficial College - Action Required">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    ${p.college_name}
                   </span>`
                : p.college_name;

            if (isDashboard) {
                return `
                    <tr onclick="showParticipantDetails('${p.id}')">
                        <td style="font-weight: 600; color: var(--primary-color);">${p.ssv_reg_no || 'N/A'}</td>
                        <td>${p.full_name}</td>
                        <td>${collegeDisplay}</td>
                        <td>${p.register_number}</td>
                        <td>${p.gender}</td>
                        <td>${p.weight_category}</td>
                    </tr>
                `;
            }

            return `
                <tr onclick="showParticipantDetails('${p.id}')">
                    <td style="font-weight: 600; color: var(--primary-color);">${p.ssv_reg_no || 'N/A'}</td>
                    <td>${p.full_name}</td>
                    <td>${collegeDisplay}</td>
                    <td>${p.register_number}</td>
                    <td>${p.gender}</td>
                    <td>${p.weight_category}</td>
                    <td>${displayAge || 'N/A'}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #fbbf24; color: white;" onclick="event.stopPropagation(); suspendRegistration('${p.id}', '${p.status || 'Active'}')">${p.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
                            <button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #60a5fa; color: white;" onclick="event.stopPropagation(); editRegistration('${p.id}')">Edit</button>
                            <button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #ef4444; color: white;" onclick="event.stopPropagation(); deleteRegistration('${p.id}', '${p.full_name}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    window.showParticipantDetails = (id) => {
        const p = window.allParticipants.find(item => item.id === id);
        if (!p) return;

        const content = document.getElementById('participantDetailsContent');
        const modal = document.getElementById('participantDetailsModal');

        // Always prioritize fresh age calculation from DOB
        let displayAge = null;
        if (p.dob) {
            const dob = new Date(p.dob);
            const cutoff = new Date('2025-07-01');
            displayAge = cutoff.getFullYear() - dob.getFullYear();
            const m = cutoff.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && cutoff.getDate() < dob.getDate())) {
                displayAge--;
            }
        } else {
            displayAge = p.age;
        }

        // Parse emergency contact if it's a combined string "Name (Phone)"
        let eName = p.emergency_contact_name || 'N/A';
        let ePhone = p.emergency_contact_phone || 'N/A';

        if (p.emergency_contact && eName === 'N/A') {
            const match = p.emergency_contact.match(/(.*)\s\((.*)\)/);
            if (match) {
                eName = match[1];
                ePhone = match[2];
            } else {
                eName = p.emergency_contact;
            }
        }

        content.innerHTML = `
            <div class="details-grid" style="gap: 1rem; margin-top: 0.5rem;">
                <div class="details-item details-full">
                    <span class="details-label">Custom Registration ID</span>
                    <span class="details-value" style="font-size: 1.1rem; font-weight: 700; color: var(--primary-color);">${p.ssv_reg_no || 'N/A'}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Full Name</span>
                    <span class="details-value">${p.full_name}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Email Address</span>
                    <span class="details-value">${p.email || 'N/A'}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">University Reg No</span>
                    <span class="details-value">${p.register_number}</span>
                </div>
                <div class="details-item details-full">
                    <span class="details-label">College / Institution</span>
                    <span class="details-value" style="display: flex; align-items: center; gap: 8px;">
                        ${p.college_name}
                        ${!window.officialColleges?.has(p.college_name) ? `
                            <span style="background: #fff7ed; color: #c2410c; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; border: 1px solid #ffedd5;">UNOFFICIAL</span>
                        ` : ''}
                    </span>
                </div>
                <div class="details-item">
                    <span class="details-label">Gender</span>
                    <span class="details-value">${p.gender}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Weight Category</span>
                    <span class="details-value">${p.weight_category}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Date of Birth</span>
                    <span class="details-value">${p.dob || 'N/A'}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Age (as of 01/07/2025)</span>
                    <span class="details-value">${displayAge || 'N/A'}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Phone Number</span>
                    <span class="details-value" style="display: flex; align-items: center; gap: 10px;">
                        ${p.phone}
                        <a href="https://wa.me/91${p.phone}" target="_blank" class="btn" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; background: #25D366; color: white; display: flex; align-items: center; gap: 5px; border-radius: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path></svg>
                            WhatsApp
                        </a>
                    </span>
                </div>
                <div class="details-item">
                    <span class="details-label">Emergency Contact</span>
                    <span class="details-value">${eName}</span>
                </div>
                <div class="details-item">
                    <span class="details-label">Emergency Phone</span>
                    <span class="details-value" style="display: flex; align-items: center; gap: 10px;">
                        ${ePhone}
                        ${ePhone !== 'N/A' && /^\d{10}$/.test(ePhone.trim()) ? `
                        <a href="https://wa.me/91${ePhone.trim()}" target="_blank" class="btn" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; background: #25D366; color: white; display: flex; align-items: center; gap: 5px; border-radius: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path></svg>
                            WhatsApp
                        </a>` : ''}
                    </span>
                </div>
                <div class="details-item details-full">
                    <span class="details-label">Registration Date</span>
                    <span class="details-value">${new Date(p.created_at).toLocaleString()}</span>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    };

    window.closeDetailsModal = () => {
        const modal = document.getElementById('participantDetailsModal');
        if (modal) modal.style.display = 'none';
    };

    async function loadColleges() {
        // Fetch master list of colleges
        const { data: masterColleges, error: masterError } = await supabaseAdmin
            .from('colleges')
            .select('name');

        if (masterError) console.error('Error fetching master colleges:', masterError);

        // Fetch participant counts
        const { data: participantsData, error: participantsError } = await supabaseAdmin
            .from('participants')
            .select('college_name');

        if (participantsError) {
            const tbody = document.getElementById('collegesList');
            if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Error: ${participantsError.message}</td></tr>`;
            return;
        }

        const participantStats = (participantsData || []).reduce((acc, curr) => {
            const name = curr.college_name;
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});

        const masterNames = (masterColleges || []).map(c => c.name);

        window.allColleges = masterNames.map(name => ({
            name,
            count: participantStats[name] || 0
        }));

        window.suggestedColleges = Object.keys(participantStats)
            .filter(name => !masterNames.includes(name))
            .map(name => ({
                name,
                count: participantStats[name]
            }));

        // Sort both lists
        window.allColleges.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        window.suggestedColleges.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        renderColleges(window.allColleges, window.suggestedColleges);
    }

    window.renderColleges = function (masterList, suggestedList) {
        const tbody = document.getElementById('collegesList');
        const suggestedTbody = document.getElementById('suggestedCollegesList');
        const suggestedSection = document.getElementById('suggested-colleges-section');

        if (!tbody) return;

        // Render Suggested Colleges if any
        if (suggestedSection && suggestedTbody) {
            const listToUse = suggestedList || window.suggestedColleges || [];
            if (listToUse.length > 0) {
                suggestedSection.style.display = 'block';
                suggestedTbody.innerHTML = listToUse.map(c => {
                    const safeName = (c.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    return `
                        <tr>
                            <td><span style="background: #fff8e1; color: #b7791f; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; margin-right: 8px;">SUGGESTED</span> ${c.name}</td>
                            <td style="font-weight: 600;">${c.count}</td>
                            <td>
                                <button class="btn btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; background: var(--secondary-color); margin-right: 5px;" onclick="approveCollege('${safeName}')">Approve & Add</button>
                                <button class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; background: #ef4444; color: white;" onclick="deleteSuggestedCollege('${safeName}', ${c.count})">Ignore</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                suggestedSection.style.display = 'none';
            }
        }

        // Render Master Colleges
        const mList = masterList || window.allColleges || [];
        if (mList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No colleges found matching search.</td></tr>';
            return;
        }

        tbody.innerHTML = mList.map(c => {
            const rawName = c.name || '';
            const sanitizedName = rawName.replace(/^["']+|["']+$/g, '').replace(/[\n\r]/g, " ").trim();
            const safeName = sanitizedName.replace(/'/g, "\\'").replace(/"/g, "&quot;");

            return `
                <tr>
                    <td>${sanitizedName}</td>
                    <td style="font-weight: 600;">${c.count}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; margin-right: 5px;" onclick="editCollege('${safeName}')">Edit</button>
                        <button class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; background: #ef4444; color: white;" onclick="deleteCollege('${safeName}', ${c.count})">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    window.approveCollege = async (name) => {
        showAdminModal({
            title: 'Approve Institution',
            message: `Do you want to add "${name}" to the master institution list ? This will make it officially selectable by other participants.`,
            showMath: false,
            onConfirm: async () => {
                const { error } = await supabaseAdmin.from('colleges').insert({ name });
                if (error) {
                    showAdminModal({ title: 'Error', message: error.message });
                } else {
                    loadColleges();
                    closeAdminModal();
                }
            }
        });
    };

    window.deleteSuggestedCollege = (name, count) => {
        showAdminModal({
            title: 'Ignore Suggestion',
            message: `Are you sure you want to ignore this suggestion ? Participants who used this name(${count}) will still have it in their records, but this name won't be added to the official list.`,
            isDanger: true,
            onConfirm: () => {
                // Actually, "Ignoring" a suggestion just means not adding it to 'colleges'
                // But if the admin wants to DELETE it from the participant records too, that's different.
                // For now, let's just allow deleting it from the suggestion view (but it will reappear since it's in participants).
                // To truly "ignore" it, we'd need an 'ignored_colleges' table or a status flag.
                // Given the current architecture, let's just say "Delete it from the participants" if they want to clean it up.
                showAdminModal({
                    title: 'Clean Up Registration?',
                    message: `To remove this suggestion, you must either approve it or edit the participants using it to a different college. Would you like to edit it instead?`,
                    onConfirm: () => {
                        editCollege(name);
                    }
                });
            }
        });
    }

    window.exportToCSV = async () => {
        const { data, error } = await supabaseAdmin.from('participants').select('*');
        if (error) {
            showAdminModal({ title: 'Export Failed', message: error.message });
            return;
        }

        const csvRows = [];
        const headers = ['Registration ID', 'Full Name', 'Email', 'College', 'Reg No', 'Gender', 'Category', 'Age', 'Phone', 'Created At'];
        csvRows.push(headers.join(','));

        data.forEach(p => {
            csvRows.push([
                `"${p.ssv_reg_no || 'N/A'}"`, `"${p.full_name}"`, `"${p.email || 'N/A'}"`, `"${p.college_name}"`, `"${p.register_number}"`,
                `"${p.gender}"`, `"${p.weight_category}"`, `"${p.age}"`, `"${p.phone}"`, `"${p.created_at}"`
            ].join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'MGUPC_Data_Export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.downloadSampleCollegesCSV = () => {
        const sampleData = "SL No., College name\n1, S.S.V. College Valayanchirangara\n2, St. Teresa's College Ernakulam\n3, Sacred Heart College Thevara\n4, Maharajas College Ernakulam";
        const blob = new Blob([sampleData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'sample_colleges.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.importColleges = async () => {
        const fileInput = document.getElementById('collegeCsvInput');
        const statusDiv = document.getElementById('import-status');

        if (!fileInput.files.length) {
            showAdminModal({ title: 'Input Required', message: 'Please select a CSV file to import.' });
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        if (statusDiv) statusDiv.textContent = 'Processing...';

        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            const startIdx = (lines[0] && (lines[0].toLowerCase().includes('sl no') || lines[0].toLowerCase().includes('college'))) ? 1 : 0;

            const rows = lines.slice(startIdx).map(line => {
                const parts = line.split(',');
                return (parts.length > 1 ? parts[1].trim() : parts[0].trim());
            }).filter(name => name.length > 0);

            const uniqueRows = [...new Set(rows)];

            const { error } = await supabaseAdmin
                .from('colleges')
                .upsert(uniqueRows.map(name => ({ name })), { onConflict: 'name' });

            if (error) {
                showAdminModal({ title: 'Import Failed', message: error.message });
            } else {
                showAdminModal({ title: 'Success', message: `Imported ${uniqueRows.length} institutions successfully.` });
                loadColleges();
            }
        };
        reader.readAsText(file);
    };

    window.addIndividualCollege = async () => {
        const nameInput = document.getElementById('newCollegeName');
        const name = nameInput.value.trim();

        if (!name) {
            showAdminModal({ title: 'Field Required', message: 'Please enter an institution name.' });
            return;
        }

        const { error } = await supabaseAdmin.from('colleges').insert({ name });

        if (error) {
            showAdminModal({ title: 'Error', message: error.code === '23505' ? 'This institution already exists.' : error.message });
        } else {
            showAdminModal({ title: 'Added', message: 'Institution added to master list.' });
            nameInput.value = '';
            loadColleges();
        }
    };

    window.editCollege = (oldName) => {
        showAdminModal({
            title: 'Edit Institution',
            message: `Update name for '${oldName}'. All related student records will sync automatically.`,
            showInput: true,
            inputValue: oldName,
            showMath: true,
            onConfirm: async (newName) => {
                if (!newName || newName === oldName) {
                    closeAdminModal();
                    return;
                }

                const { error } = await supabaseAdmin.from('colleges').update({ name: newName }).eq('name', oldName);

                if (error) {
                    showAdminModal({ title: 'Error', message: error.message });
                } else {
                    await supabaseAdmin.from('participants').update({ college_name: newName }).eq('college_name', oldName);
                    loadColleges();
                    closeAdminModal();
                }
            }
        });
    };

    window.deleteCollege = (name, count) => {
        const message = count > 0
            ? `Warning: "${name}" has ${count} registrations. Removing it will detach these students from the institution list.`
            : `Remove "${name}" from the master list?`;

        showAdminModal({
            title: 'Delete Institution',
            message: message,
            isDanger: true,
            showMath: true,
            onConfirm: async () => {
                const { error } = await supabaseAdmin.from('colleges').delete().eq('name', name);
                if (error) {
                    showAdminModal({ title: 'Error', message: error.message });
                } else {
                    loadColleges();
                    closeAdminModal();
                }
            }
        });
    };

    // --- Modal System Logic ---
    window.showToast = (message, type = 'success') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.cssText = `
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            animation: slideIn 0.3s ease-out forwards;
        `;

        toast.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'}
            </svg>
            ${message}
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // Add required keyframes for toast
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(120%); } to { transform: translateX(0); } }
            @keyframes slideOut { from { transform: translateX(0); } to { transform: translateX(120%); } }
        `;
        document.head.appendChild(style);
    }

    let currentMathResult = 0;

    window.showAdminModal = ({ title, message, showInput, inputValue, isDanger, showMath, onConfirm }) => {
        const modal = document.getElementById('adminModal');
        if (!modal) {
            console.error('Modal container #adminModal not found');
            return;
        }

        const titleEl = document.getElementById('modalTitle');
        const msgEl = document.getElementById('modalMessage');
        const errorBox = document.getElementById('modal-error');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        if (errorBox) {
            errorBox.textContent = '';
            errorBox.style.display = 'none';
        }

        const inputContainer = document.getElementById('modalInputContainer');
        const inputField = document.getElementById('modalInput');
        if (inputContainer) inputContainer.style.display = showInput ? 'block' : 'none';
        if (inputField && showInput) inputField.value = inputValue || '';

        const mathBox = document.getElementById('mathChallengeBox');
        if (mathBox) {
            if (showMath) {
                const a = Math.floor(Math.random() * 10) + 1;
                const b = Math.floor(Math.random() * 10) + 1;
                currentMathResult = a + b;
                const mathExpr = document.getElementById('mathExpression');
                if (mathExpr) mathExpr.textContent = `Identity Verification: ${a} + ${b} = ?`;
                const mathAns = document.getElementById('mathAnswer');
                if (mathAns) mathAns.value = '';
                mathBox.style.display = 'block';
            } else {
                mathBox.style.display = 'none';
            }
        }

        const cancelBtn = document.getElementById('modalCancelBtn');
        if (cancelBtn) {
            cancelBtn.style.display = onConfirm ? 'inline-block' : 'none';
        }

        const confirmBtn = document.getElementById('modalConfirmBtn');
        if (confirmBtn) {
            confirmBtn.textContent = onConfirm ? 'Verify & Proceed' : 'OK';
            confirmBtn.className = isDanger ? 'btn-confirm danger' : 'btn-confirm';

            confirmBtn.onclick = async () => {
                if (showMath) {
                    const mathAns = document.getElementById('mathAnswer');
                    const userAnswer = mathAns ? parseInt(mathAns.value) : NaN;
                    if (userAnswer !== currentMathResult) {
                        if (errorBox) {
                            errorBox.textContent = 'Incorrect verification code. Please try again.';
                            errorBox.style.display = 'block';
                        }
                        return;
                    }
                }

                if (typeof onConfirm === 'function') {
                    await onConfirm(showInput ? (inputField ? inputField.value : null) : null);
                } else {
                    closeAdminModal();
                }
            };
        }

        modal.style.display = 'flex';
    };

    window.closeAdminModal = () => {
        const modal = document.getElementById('adminModal');
        if (modal) modal.style.display = 'none';
    };
    window.suspendRegistration = async (id, currentStatus) => {
        const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
        showAdminModal({
            title: `${newStatus === 'Suspended' ? 'Suspend' : 'Activate'} Registration`,
            message: `Are you sure you want to ${newStatus === 'Suspended' ? 'suspend' : 'activate'} this registration?`,
            onConfirm: async () => {
                const { data, error } = await supabaseAdmin
                    .from('participants')
                    .update({ status: newStatus })
                    .eq('id', id)
                    .select();

                console.log('Suspend Debug:', { id, newStatus, data, error });

                if (error) {
                    showAdminModal({ title: 'Error', message: error.message });
                } else if (!data || data.length === 0) {
                    showAdminModal({ title: 'Update Failed', message: 'No records updated. Check if the registration exists and you have permission to edit it.' });
                } else {
                    await loadParticipants();
                    if (document.getElementById('stat-total')) await loadStats();
                    closeAdminModal();
                }
            }
        });
    };

    window.editRegistration = (id) => {
        const p = window.allParticipants.find(item => item.id === id);
        if (!p) return;

        // Simplified Edit Modal using showAdminModal with multiple inputs is complex, 
        // but let's build a dedicated edit modal structure or reuse the card.
        // For speed, let's inject a specialized edit modal if not exists
        if (!document.getElementById('editRegistrationModal')) {
            const editModalHTML = `
                <div id="editRegistrationModal" class="modal-overlay">
                    <div class="modal-card" style="max-width: 700px; width: 95%;">
                        <h3 style="margin-bottom: 1.5rem;">Comprehensive Edit Profile</h3>
                        <form id="editRegForm">
                            <input type="hidden" id="edit-id">
                            <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-height: 65vh; overflow-y: auto; padding-right: 5px;">
                                <div class="form-group">
                                    <label class="details-label">Full Name</label>
                                    <input type="text" id="edit-name" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">University Reg No</label>
                                    <input type="text" id="edit-regno" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Email Address</label>
                                    <input type="email" id="edit-email" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Phone Number</label>
                                    <input type="tel" id="edit-phone" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">College Name</label>
                                    <input type="text" id="edit-college" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Gender</label>
                                    <select id="edit-gender" class="modal-input" required>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Weight Category</label>
                                    <input type="text" id="edit-category" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Date of Birth</label>
                                    <input type="date" id="edit-dob" class="modal-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Emergency Contact (Combined)</label>
                                    <input type="text" id="edit-emergency" class="modal-input" placeholder="Name (Phone)" required>
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Zone</label>
                                    <input type="text" id="edit-zone" class="modal-input">
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Custom Reg ID (Careful)</label>
                                    <input type="text" id="edit-ssv-reg" class="modal-input">
                                </div>
                                <div class="form-group">
                                    <label class="details-label">Status</label>
                                    <select id="edit-status" class="modal-input">
                                        <option value="Active">Active</option>
                                        <option value="Suspended">Suspended</option>
                                    </select>
                                </div>
                            </div>
                            <div class="modal-actions" style="margin-top: 2rem; border-top: 1px solid #eee; pt: 1.5rem;">
                                <button type="button" class="btn-cancel" onclick="closeEditModal()">Discard Changes</button>
                                <button type="submit" class="btn-confirm">Update Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', editModalHTML);

            document.getElementById('editRegForm').onsubmit = async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-id').value;
                const payload = {
                    full_name: document.getElementById('edit-name').value,
                    register_number: document.getElementById('edit-regno').value,
                    email: document.getElementById('edit-email').value,
                    phone: document.getElementById('edit-phone').value,
                    college_name: document.getElementById('edit-college').value,
                    gender: document.getElementById('edit-gender').value,
                    weight_category: document.getElementById('edit-category').value,
                    dob: document.getElementById('edit-dob').value,
                    emergency_contact: document.getElementById('edit-emergency').value,
                    zone: document.getElementById('edit-zone').value,
                    ssv_reg_no: document.getElementById('edit-ssv-reg').value,
                    status: document.getElementById('edit-status').value
                };

                const { data, error } = await supabaseAdmin
                    .from('participants')
                    .update(payload)
                    .eq('id', id)
                    .select();

                console.log('Edit Debug:', { id, payload, data, error });

                if (error) {
                    showAdminModal({ title: 'Update Failed', message: error.message });
                } else if (!data || data.length === 0) {
                    showAdminModal({ title: 'Update Incomplete', message: 'Database reported success, but no records were changed. Permissions/RLS may be blocking this action.' });
                } else {
                    closeEditModal();
                    await loadParticipants();
                    if (document.getElementById('stat-total')) await loadStats();
                    showAdminModal({ title: 'Success', message: 'Participant profile updated successfully.' });
                }
            };
        }

        document.getElementById('edit-id').value = p.id;
        document.getElementById('edit-name').value = p.full_name || '';
        document.getElementById('edit-regno').value = p.register_number || '';
        document.getElementById('edit-email').value = p.email || '';
        document.getElementById('edit-phone').value = p.phone || '';
        document.getElementById('edit-college').value = p.college_name || '';
        document.getElementById('edit-gender').value = p.gender || 'Male';
        document.getElementById('edit-category').value = p.weight_category || '';
        document.getElementById('edit-dob').value = p.dob || '';
        document.getElementById('edit-emergency').value = p.emergency_contact || '';
        document.getElementById('edit-zone').value = p.zone || '';
        document.getElementById('edit-ssv-reg').value = p.ssv_reg_no || '';
        document.getElementById('edit-status').value = p.status || 'Active';

        document.getElementById('editRegistrationModal').style.display = 'flex';
    };

    window.closeEditModal = () => {
        document.getElementById('editRegistrationModal').style.display = 'none';
    };

    window.deleteRegistration = (id, name) => {
        showAdminModal({
            title: 'Delete Registration',
            message: `Are you sure you want to permanently delete the registration for ${name}? This action cannot be undone.`,
            isDanger: true,
            showMath: true,
            onConfirm: async () => {
                const { data, error } = await supabaseAdmin
                    .from('participants')
                    .delete()
                    .eq('id', id)
                    .select();

                console.log('Delete Debug:', { id, data, error });

                if (error) {
                    showAdminModal({ title: 'Error', message: error.message });
                } else if (!data || data.length === 0) {
                    showAdminModal({ title: 'Deletion Failed', message: 'No records deleted. The record may prefer to remain or you lack permission.' });
                } else {
                    await loadParticipants();
                    if (document.getElementById('stat-total')) await loadStats();
                    closeAdminModal();
                }
            }
        });
    };
})();
