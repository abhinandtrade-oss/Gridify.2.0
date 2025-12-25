import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/**
 * Fun Zone Services Configuration
 * Backend: Firebase Firestore
 * 
 * NOTE: Firebase Config is inlined here to avoid CORS issues with local file imports 
 * when running directly via file:// protocol.
 */

const firebaseConfig = {
    apiKey: "AIzaSyD9G64Wu-hOHadZUfk9EG8MaXfqL7T9-F0",
    authDomain: "grfy-b1731.firebaseapp.com",
    projectId: "grfy-b1731",
    storageBucket: "grfy-b1731.firebasestorage.app",
    messagingSenderId: "376190086826",
    appId: "1:376190086826:web:71c268ada23c4163f02ad3",
    measurementId: "G-M45BCQPTPV"
};

// Initialize Firebase internally
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
            let services = snapshot.data().services;
            console.log("[FunConfig] Services fetched:", services.length);
            return services;
        } else {
            console.log("[FunConfig] No config found, initializing defaults.");
            await saveFunServices(DEFAULT_FUN_SERVICES);
            return DEFAULT_FUN_SERVICES;
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
            let sections = snapshot.data().sections;
            console.log("[FunConfig] Sections fetched:", sections.length);
            return sections;
        } else {
            // Init defaults
            await saveFunSections(DEFAULT_SECTIONS);
            return DEFAULT_SECTIONS;
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

// --- Real-time Subscription ---
export function subscribeToFunZone(callback) {
    return onSnapshot(CONFIG_DOC_REF, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            // Fallback to defaults if fields are explicitly undefined (missing)
            // But allow empty arrays if they exist (user cleared them)
            const services = data.services !== undefined ? data.services : DEFAULT_FUN_SERVICES;
            const sections = data.sections !== undefined ? data.sections : DEFAULT_SECTIONS;

            callback(services, sections);
        } else {
            // Document doesn't exist at all -> use defaults
            callback(DEFAULT_FUN_SERVICES, DEFAULT_SECTIONS);
        }
    }, (error) => {
        console.error("[FunConfig] Real-time Error:", error);
    });
}
