import { db } from '../assets/js/firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Collection Name
const COL_SERVICES = 'services';

export class ServiceManager {

    static async init() {
        console.log("Service Manager Initializing...");
        await this.checkAuth();
        this.loadServices();
        this.setupEventListeners();
    }

    static async checkAuth() {
        // Simple Admin Check (matching other modules)
        const session = sessionStorage.getItem('gridify_admin_session');
        if (!session) {
            // Redirect to login if not authenticated
            window.location.href = '../login/index.html';
            return;
        }

        // Hide Overlay
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.style.display = 'none';

        // Add User Name if possible
        try {
            const user = JSON.parse(session);
            console.log("Logged in as:", user.username);
        } catch (e) { }
    }

    static setupEventListeners() {
        // Modal Save Button
        const form = document.getElementById('serviceForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveService();
            });
        }

        // Global function for Edit
        window.editService = (id) => this.openEditModal(id);

        // Global function for Delete
        window.deleteService = (id) => this.deleteServiceWrapper(id);

        // Global function for Toggle
        window.toggleServiceStatus = (id, currentStatus) => this.toggleServiceStatus(id, currentStatus);

        // Make openServiceModal clear form
        window.openServiceModal = () => {
            document.getElementById('serviceForm').reset();
            document.getElementById('serviceId').value = '';
            document.getElementById('svcSlug').disabled = false; // Enable slug for new
            document.getElementById('plansContainer').innerHTML = '';
            document.getElementById('modalTitle').textContent = 'Add New Service';
            document.getElementById('imgPreview').style.display = 'none';
            document.getElementById('svcActive').checked = true; // Default active
            // Add one empty plan
            window.addPlanField();

            const modal = new bootstrap.Modal(document.getElementById('serviceModal'));
            modal.show();
        };
    }

    static async loadServices() {
        const tbody = document.getElementById('servicesTableBody');
        const loader = document.getElementById('loadingScanner');
        const noRes = document.getElementById('noResults');

        if (!tbody) return;

        tbody.innerHTML = '';
        loader.classList.remove('d-none');
        noRes.classList.add('d-none');

        try {
            const querySnapshot = await getDocs(collection(db, COL_SERVICES));
            const services = [];
            querySnapshot.forEach((doc) => {
                services.push({ id: doc.id, ...doc.data() });
            });

            // Cache for editing
            window.servicesCache = services;

            loader.classList.add('d-none');

            if (services.length === 0) {
                noRes.classList.remove('d-none');
                return;
            }

            services.forEach(svc => {
                const isActive = svc.active !== false; // Default true if undefined
                const tr = document.createElement('tr');
                tr.className = isActive ? '' : 'table-light text-muted opacity-75';

                tr.innerHTML = `
                    <td>
                        <img src="${svc.image || 'https://via.placeholder.com/50'}" class="service-img ${isActive ? '' : 'grayscale'}" alt="icon" style="${isActive ? '' : 'filter: grayscale(100%);'}">
                    </td>
                    <td>
                        <div class="fw-bold">${svc.title}</div>
                        <div class="small text-muted text-truncate" style="max-width: 250px;">${svc.description}</div>
                        <div class="badge bg-light text-dark border px-2 mt-1">ID: ${svc.id}</div>
                    </td>
                    <td class="hide-mobile">
                        <span class="badge bg-primary-soft text-primary fw-bold">${svc.plans ? svc.plans.length : 0} Plans</span>
                    </td>
                    <td>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" onchange="toggleServiceStatus('${svc.id}', ${isActive})" ${isActive ? 'checked' : ''}>
                            <label class="form-check-label small">${isActive ? 'Active' : 'Hidden'}</label>
                        </div>
                    </td>
                    <td class="text-end">
                        <button class="action-btn" onclick="editService('${svc.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteService('${svc.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error loading services:", error);
            loader.innerHTML = '<p class="text-danger">Error loading data.</p>';
        }
    }

    static async saveService() {
        const btn = document.getElementById('btnSave');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            // Collect Form Data
            const id = document.getElementById('serviceId').value;
            let slug = document.getElementById('svcSlug').value.trim();
            const title = document.getElementById('svcTitle').value.trim();
            const image = document.getElementById('svcImage').value.trim();
            const desc = document.getElementById('svcDesc').value.trim();
            const active = document.getElementById('svcActive').checked;

            if (!slug) slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            // Collect Plans
            const plans = [];
            const planCards = document.querySelectorAll('.plan-card');
            planCards.forEach(card => {
                plans.push({
                    name: card.querySelector('.plan-name').value,
                    price: Number(card.querySelector('.plan-price').value),
                    displayPrice: card.querySelector('.plan-display').value,
                    desc: card.querySelector('.plan-desc').value
                });
            });

            const serviceData = {
                title,
                image,
                description: desc,
                active,
                plans
            };

            // If ID exists (Edit Mode), strictly use that ID. New Mode uses Slug.
            const docId = id || slug;

            await setDoc(doc(db, COL_SERVICES, docId), serviceData, { merge: true }); // Merge ensures we don't lose other fields if any

            // Close Modal & Reload
            const modalEl = document.getElementById('serviceModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            this.loadServices();
            // alert("Service saved successfully!");

        } catch (error) {
            console.error("Error saving service:", error);
            alert("Error saving: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    static async toggleServiceStatus(id, currentStatus) {
        // Optimistic UI update could go here, but reload is safer for sync
        try {
            await setDoc(doc(db, COL_SERVICES, id), { active: !currentStatus }, { merge: true });
            this.loadServices(); // Reload to refresh table UI
        } catch (e) {
            console.error("Toggle error", e);
            alert("Failed to toggle status");
        }
    }

    static openEditModal(id) {
        const service = window.servicesCache.find(s => s.id === id);
        if (!service) return;

        document.getElementById('serviceId').value = service.id;
        document.getElementById('svcSlug').value = service.id;
        document.getElementById('svcSlug').disabled = true; // Cannot change ID after creation
        document.getElementById('svcTitle').value = service.title;
        document.getElementById('svcImage').value = service.image;
        document.getElementById('svcDesc').value = service.description;
        document.getElementById('svcActive').checked = service.active !== false; // Default true
        document.getElementById('imgPreview').src = service.image;
        document.getElementById('imgPreview').style.display = 'block';
        document.getElementById('modalTitle').textContent = 'Edit Service';

        // Load Plans
        const container = document.getElementById('plansContainer');
        container.innerHTML = '';
        if (service.plans && service.plans.length > 0) {
            service.plans.forEach(plan => window.addPlanField(plan));
        } else {
            window.addPlanField();
        }

        const modal = new bootstrap.Modal(document.getElementById('serviceModal'));
        modal.show();
    }

    static async deleteServiceWrapper(id) {
        if (!confirm("Are you sure you want to delete this service? This action cannot be undone.")) return;

        try {
            await deleteDoc(doc(db, COL_SERVICES, id));
            this.loadServices();
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete service.");
        }
    }
    static async initializeDefaults() {
        if (!confirm("This will upload standard default services (Web Design, SEO, etc.) to the database. Proceed?")) return;

        const loader = document.getElementById('loadingScanner');
        if (loader) loader.innerHTML = '<div class="spinner-border text-primary"></div> Uploading Defaults...';
        if (loader) loader.classList.remove('d-none');

        const servicesToUpload = {
            'web-design': {
                title: 'Web Design',
                active: true,
                image: 'https://pub-141831e61e69445289222976a15b6fb3.r2.dev/1764756085037-gf63o3u98am-1764756071640_8eq71f_rectangle_35.png',
                description: 'Custom, responsive, and performance-optimized websites tailored to your brand.',
                plans: [
                    { name: 'Regular', price: 3799, displayPrice: '₹ 3,799', desc: 'Up to 2 pages, 2 forms, Basic Support' },
                    { name: 'Standard', price: 11799, displayPrice: '₹ 11,799', desc: '3-5 pages, 4 forms, Email Alerts, SEO Basic' },
                    { name: 'Premium', price: 18999, displayPrice: '₹ 18999', desc: 'Custom size (4-6 pages), Advanced SEO, Priority Support' }
                ]
            },
            'poster-designing': {
                title: 'Poster Designing',
                active: true,
                image: 'https://pub-141831e61e69445289222976a15b6fb3.r2.dev/1764492678080-2b1b2t4tqvg-1764492668501_0qiyyq_untitled-1.png',
                description: 'Eye-catching posters for events, promotions, and branding.',
                plans: [
                    { name: 'Basic Poster', price: 499, displayPrice: '₹ 499', desc: '1 Concept, HD Digital File' },
                    { name: 'Pro Poster', price: 999, displayPrice: '₹ 999', desc: '3 Concepts, Source File, Print Ready' }
                ]
            },
            'seo': {
                title: 'SEO Services',
                active: true,
                image: 'https://i.postimg.cc/ZKyVgH2d/image.png',
                description: 'Boost your visibility and rank higher on search engines.',
                plans: [
                    { name: 'Starter SEO', price: 4999, displayPrice: '₹ 4,999/mo', desc: 'On-page Optimization, 5 Keywords' },
                    { name: 'Growth SEO', price: 9999, displayPrice: '₹ 9,999/mo', desc: 'On-page & Off-page, 15 Keywords, Monthly Report' }
                ]
            },
            'brand-making': {
                title: 'Brand Making',
                active: true,
                image: 'https://i.postimg.cc/VkDSKx9Z/unnamed.jpg',
                description: 'Complete branding solutions including logo, guidelines, and stationery.',
                plans: [
                    { name: 'Logo Design', price: 1999, displayPrice: '₹ 1,999', desc: '3 Logo Concepts, Vector Files' },
                    { name: 'Full Branding', price: 9999, displayPrice: '₹ 9,999', desc: 'Logo, Business Card, Letterhead, Brand Guidelines' }
                ]
            },
            'property-listing': {
                title: 'Property Listing',
                active: true,
                image: 'https://i.postimg.cc/x1wrVCPQ/unnamed.jpg',
                description: 'Professional listing management for real estate.',
                plans: [
                    { name: 'Single Listing', price: 999, displayPrice: '₹ 999', desc: '1 Property, 1 Month Visibility' },
                    { name: 'Premium Bundle', price: 4999, displayPrice: '₹ 4,999', desc: '10 Properties, 3 Months Visibility, Featured Tag' }
                ]
            }
        };

        try {
            for (const [id, data] of Object.entries(servicesToUpload)) {
                await setDoc(doc(db, COL_SERVICES, id), data);
                console.log(`Uploaded: ${id}`);
            }
            alert("Defaults uploaded successfully!");
            this.loadServices();
        } catch (error) {
            console.error("Upload error:", error);
            alert("Error uploading defaults: " + error.message);
            if (loader) loader.classList.add('d-none');
        }
    }
}

// Expose globally
window.ServiceManager = ServiceManager;

// Initial Run
document.addEventListener('DOMContentLoaded', () => {
    ServiceManager.init();
});
