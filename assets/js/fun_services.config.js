/**
 * Fun Zone Services Configuration
 * Supports dynamic sections and services.
 */

const DEFAULT_SECTIONS = [
    { id: 'fun', title: 'Fun Zone' },
    { id: 'tools', title: 'Productivity Tools' }
];

const DEFAULT_FUN_SERVICES = [
    // --- Fun Zone ---
    {
        id: 'love-letter',
        title: 'Love Letter',
        description: 'Send a romantic surprise to your loved ones.',
        path: 'developments/love-letter/index.html',
        category: 'fun',
        iconClass: 'fas fa-heart',
        wrapperClass: 'icon-love',
        enabled: true
    },
    {
        id: 'true-feedback',
        title: 'True Feedback',
        description: 'Receive anonymous messages and honest feedback.',
        path: 'developments/anonymous-messages/index.html',
        category: 'fun',
        iconClass: 'fas fa-envelope-open-text',
        wrapperClass: 'icon-msg',
        enabled: true
    },

    // --- Productivity Tools ---
    {
        id: 'qr-generator',
        title: 'QR Generator',
        description: 'Generate custom QR codes instantly.',
        path: 'developments/qr-code-gen/index.html',
        category: 'tools',
        iconClass: 'fas fa-qrcode',
        wrapperClass: 'icon-qr',
        enabled: true
    },
    {
        id: 'pdf-editor',
        title: 'PDF Editor',
        description: 'Edit, merge, and manage your PDF documents easily.',
        path: 'developments/PDF Editor/index.html',
        category: 'tools',
        iconClass: 'fas fa-file-pdf',
        wrapperClass: 'icon-pdf',
        enabled: true
    },
    {
        id: 'scanner',
        title: 'Scanner',
        description: 'Scan documents and codes directly from your browser.',
        path: 'developments/Scanner/index.html',
        category: 'tools',
        iconClass: 'fas fa-camera',
        wrapperClass: 'icon-scan',
        enabled: true
    },
    {
        id: 'image-to-url',
        title: 'Image to URL',
        description: 'Convert images to shareable links instantly.',
        path: 'developments/imageURL/index.html',
        category: 'tools',
        iconClass: 'fas fa-link',
        wrapperClass: 'icon-link',
        enabled: true
    },
    {
        id: 'case-study-builder',
        title: 'Case Study Builder',
        description: 'Create professional case studies with ease.',
        path: 'developments/case-study-builder/index.html',
        category: 'tools',
        iconClass: 'fas fa-book-open',
        wrapperClass: 'icon-case',
        enabled: true
    },
    {
        id: 'attendance',
        title: 'Attendance',
        description: 'Track attendance efficiently with this tool.',
        path: 'developments/attendance/index.html',
        category: 'tools',
        iconClass: 'fas fa-clipboard-check',
        wrapperClass: 'icon-attend',
        enabled: true
    }
];

// Keys
const FUN_SERVICES_KEY = 'gridify_fun_services_config';
const FUN_SECTIONS_KEY = 'gridify_fun_sections_config';

// --- Services Config ---
export function getFunServices() {
    const stored = localStorage.getItem(FUN_SERVICES_KEY);
    if (!stored) return DEFAULT_FUN_SERVICES;
    return JSON.parse(stored);
}

export function saveFunServices(services) {
    localStorage.setItem(FUN_SERVICES_KEY, JSON.stringify(services));
}

export function addFunService(service) {
    const services = getFunServices();
    if (!service.id) service.id = 'svc-' + Date.now();
    if (!service.wrapperClass) service.wrapperClass = 'icon-default';
    services.push(service);
    saveFunServices(services);
}

// --- Sections Config ---
export function getFunSections() {
    const stored = localStorage.getItem(FUN_SECTIONS_KEY);
    if (!stored) return DEFAULT_SECTIONS;
    return JSON.parse(stored);
}

export function saveFunSections(sections) {
    localStorage.setItem(FUN_SECTIONS_KEY, JSON.stringify(sections));
}

export function addFunSection(section) {
    const sections = getFunSections();
    if (!section.id) section.id = section.title.toLowerCase().replace(/\s+/g, '-');
    sections.push(section);
    saveFunSections(sections);
}
