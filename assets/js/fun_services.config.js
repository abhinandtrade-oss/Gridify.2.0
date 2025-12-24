import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/**
 * Fun Zone Services Configuration
 * Supports dynamic sections and services.
 * Backend: Firebase Firestore
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

// Firestore Reference
const CONFIG_DOC_REF = doc(db, "fun_zone_config", "main");

// --- Services Config ---
export async function getFunServices() {
    console.log("[FunConfig] Fetching Services from Firestore...");
    try {
        const snapshot = await getDoc(CONFIG_DOC_REF);
        if (snapshot.exists() && snapshot.data().services) {
            console.log("[FunConfig] Services fetched:", snapshot.data().services.length);
            return snapshot.data().services;
        } else {
            console.log("[FunConfig] No config found, using defaults.");
        }
    } catch (error) {
        console.error("[FunConfig] Error getting services:", error);
    }
    return DEFAULT_FUN_SERVICES;
}

export async function saveFunServices(services) {
    console.log("[FunConfig] Saving Services...", services.length);
    try {
        await setDoc(CONFIG_DOC_REF, { services: services }, { merge: true });
        console.log("[FunConfig] Services saved successfully.");
    } catch (error) {
        console.error("[FunConfig] Error saving services:", error);
        throw error;
    }
}

export async function addFunService(service) {
    const services = await getFunServices();
    if (!service.id) service.id = 'svc-' + Date.now();
    if (!service.wrapperClass) service.wrapperClass = 'icon-default';
    services.push(service);
    await saveFunServices(services);
}

// --- Sections Config ---
export async function getFunSections() {
    console.log("[FunConfig] Fetching Sections...");
    try {
        const snapshot = await getDoc(CONFIG_DOC_REF);
        if (snapshot.exists() && snapshot.data().sections) {
            console.log("[FunConfig] Sections fetched:", snapshot.data().sections.length);
            return snapshot.data().sections;
        }
    } catch (error) {
        console.error("[FunConfig] Error getting sections:", error);
    }
    return DEFAULT_SECTIONS;
}

export async function saveFunSections(sections) {
    console.log("[FunConfig] Saving Sections...", sections.length);
    try {
        await setDoc(CONFIG_DOC_REF, { sections: sections }, { merge: true });
        console.log("[FunConfig] Sections saved successfully.");
    } catch (error) {
        console.error("[FunConfig] Error saving sections:", error);
        throw error;
    }
}

export async function addFunSection(section) {
    const sections = await getFunSections();
    if (!section.id) section.id = section.title.toLowerCase().replace(/\s+/g, '-');
    sections.push(section);
    await saveFunSections(sections);
}
