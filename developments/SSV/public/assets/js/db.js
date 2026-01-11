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
                status: 'Report Not Received',
                creationEmailSent: false
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
    },

    // --- STAFF DIRECTORY ---

    getStaff: async () => {
        try {
            const snapshot = await db.collection('staff').orderBy('name').get();
            const staff = [];
            snapshot.forEach(doc => staff.push({ id: doc.id, ...doc.data() }));
            return staff;
        } catch (error) {
            console.error("Error fetching staff:", error);
            return [];
        }
    },

    addStaff: async (staffData) => {
        try {
            // Check if email already exists to avoid duplicates? 
            // For now, let's assume the CSV logic handles deduplication or we check before calling.
            // But to be safe, let's query by email first? 
            // The request implies bulk update, so we might handle "upsert" logic in the UI layer for now
            // or here. Let's just do simple Add.
            const docRef = await db.collection('staff').add(staffData);
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    updateStaff: async (id, data) => {
        try {
            await db.collection('staff').doc(id).update(data);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    deleteStaff: async (id) => {
        try {
            await db.collection('staff').doc(id).delete();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Helper for batched imports (cleaner than individual calls)
    batchUpdateStaff: async (toAdd, toUpdate, toDelete) => {
        const batch = db.batch();

        toAdd.forEach(item => {
            const docRef = db.collection('staff').doc(); // Auto-ID
            batch.set(docRef, item);
        });

        toUpdate.forEach(item => {
            const docRef = db.collection('staff').doc(item.id);
            const { id, ...data } = item;
            batch.update(docRef, data);
        });

        toDelete.forEach(id => {
            const docRef = db.collection('staff').doc(id);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};
