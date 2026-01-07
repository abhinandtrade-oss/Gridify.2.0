/**
 * DB Service
 * Wrapper for Firestore Operations
 */

const DBService = {
    // Events Configuration
    collectionEvents: 'events',
    collectionUsers: 'users',
    collectionConfig: 'config', // For storing script URL

    // --- EVENTS ---

    createEvent: async (eventData) => {
        try {
            const docRef = await db.collection('events').add({
                ...eventData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                reminderCount: 0,
                status: 'Report Not Received'
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    getEvents: async (filters = {}) => {
        try {
            let query = db.collection('events').orderBy('createdAt', 'desc');
            const snapshot = await query.get();
            const events = [];
            snapshot.forEach(doc => {
                events.push({ id: doc.id, ...doc.data() });
            });
            return events;
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    subscribeToEvents: (onUpdate, onError) => {
        return db.collection('events')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const events = [];
                snapshot.forEach(doc => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                onUpdate(events);
            }, error => {
                console.error("Error subscribing to events: ", error);
                if (onError) onError(error);
            });
    },

    getEventById: async (id) => {
        try {
            const doc = await db.collection('events').doc(id).get();
            if (doc.exists) return { id: doc.id, ...doc.data() };
            return null;
        } catch (error) {
            return null;
        }
    },

    updateEvent: async (id, data) => {
        try {
            await db.collection('events').doc(id).update(data);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    deleteEvent: async (id) => {
        try {
            await db.collection('events').doc(id).delete();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // --- USERS (Admin Only) ---

    createUser: async (uid, userData) => {
        // userData: { email, role: 'user', suspended: false, ... }
        try {
            await db.collection('users').doc(uid).set(userData);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    getUsers: async () => {
        try {
            const snapshot = await db.collection('users').get();
            const users = [];
            snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
            return users;
        } catch (error) {
            return [];
        }
    },

    updateUserStatus: async (uid, suspended) => {
        try {
            await db.collection('users').doc(uid).update({ suspended });
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // --- CONFIG ---

    saveScriptUrl: async (url) => {
        try {
            await db.collection('config').doc('email_settings').set({ scriptUrl: url });
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    getScriptUrl: async () => {
        try {
            const doc = await db.collection('config').doc('email_settings').get();
            if (doc.exists) return doc.data().scriptUrl;
            return null;
        } catch (error) {
            return null;
        }
    }
};
