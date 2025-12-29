/* Database Operations */
// Assumes firebase-config.js is loaded

const DB = {
    // --- Courses ---
    async getCourses() {
        try {
            const snapshot = await window.db.collection('courses').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error getting courses:", e);
            return [];
        }
    },

    listenToCourses(callback) {
        return window.db.collection('courses').onSnapshot(snapshot => {
            const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(courses);
        }, error => console.error("Error listening to courses:", error));
    },

    // --- Categories ---
    async getCategories() {
        try {
            const snapshot = await window.db.collection('categories').orderBy('name').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error getting categories:", e);
            return [];
        }
    },

    listenToCategories(callback) {
        return window.db.collection('categories').orderBy('name').onSnapshot(snapshot => {
            const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(categories);
        }, error => console.error("Error listening to categories:", error));
    },

    async createCategory(name) {
        try {
            await window.db.collection('categories').add({
                name,
                status: 'active',
                createdAt: new Date()
            });
            return true;
        } catch (e) {
            console.error("Error creating category:", e);
            throw e;
        }
    },

    async updateCategory(id, data) {
        try {
            await window.db.collection('categories').doc(id).update(data);
            return true;
        } catch (e) {
            console.error("Error updating category:", e);
            throw e;
        }
    },

    async deleteCategory(id) {
        try {
            await window.db.collection('categories').doc(id).delete();
            return true;
        } catch (e) {
            console.error("Error deleting category:", e);
            throw e;
        }
    },

    // --- Admin Operations ---
    async createCourse(courseData) {
        try {
            await window.db.collection('courses').add(courseData);
            return true;
        } catch (e) {
            console.error("Error creating course:", e);
            throw e;
        }
    },

    async updateCourse(courseId, data) {
        try {
            await window.db.collection('courses').doc(courseId).update(data);
            return true;
        } catch (e) {
            console.error("Error updating course:", e);
            throw e;
        }
    },

    async updateCoursePrice(courseId, price) {
        try {
            // price can be a number or 0 for free
            await window.db.collection('courses').doc(courseId).update({
                price: price,
                isFree: price === 0
            });
            return true;
        } catch (e) {
            console.error("Error updating course price:", e);
            throw e;
        }
    },

    async deleteCourse(courseId) {
        try {
            await window.db.collection('courses').doc(courseId).delete();
            return true;
        } catch (e) {
            console.error("Error deleting course:", e);
            throw e;
        }
    },

    async getAllUsers() {
        try {
            // Limit to 20 for this demo
            const snapshot = await window.db.collection('users').orderBy('createdAt', 'desc').limit(20).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            return [];
        }
    },

    listenToRecentUsers(callback) {
        return window.db.collection('users').orderBy('createdAt', 'desc').limit(5).onSnapshot(snapshot => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(users);
        }, error => console.error("Error listening to users:", error));
    },

    listenToAllUsers(callback) {
        return window.db.collection('users').orderBy('createdAt', 'desc').limit(100).onSnapshot(snapshot => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(users);
        }, error => console.error("Error listening to all users:", error));
    },

    async getStats() {
        try {
            const userSnap = await window.db.collection('users').get();
            const courseSnap = await window.db.collection('courses').get();
            const reviewsSnap = await window.db.collection('exam_submissions').where('status', '==', 'pending').get();
            const paySnap = await window.db.collection('payment_requests').where('status', '==', 'pending').get();
            const catSnap = await window.db.collection('categories').get();
            const certSnap = await window.db.collection('certificates').get();
            return {
                users: userSnap.size,
                courses: courseSnap.size,
                pendingReviews: reviewsSnap.size,
                pendingPayments: paySnap.size,
                categories: catSnap.size,
                certificates: certSnap.size,
                contacts: (await window.db.collection('contacts').get()).size
            };
        } catch (e) {
            return { users: 0, courses: 0, pendingReviews: 0, pendingPayments: 0, categories: 0, certificates: 0, contacts: 0 };
        }
    },

    listenToStats(callback) {
        // Listen to multiple collections and aggregate stats in real-time
        const unsubscribers = [];

        const statsData = {
            users: 0,
            courses: 0,
            pendingReviews: 0,
            pendingPayments: 0,
            categories: 0,
            certificates: 0,
            contacts: 0
        };

        const updateCallback = () => callback({ ...statsData });

        // Listen to users
        unsubscribers.push(window.db.collection('users').onSnapshot(snapshot => {
            statsData.users = snapshot.size;
            updateCallback();
        }));

        // Listen to courses
        unsubscribers.push(window.db.collection('courses').onSnapshot(snapshot => {
            statsData.courses = snapshot.size;
            updateCallback();
        }));

        // Listen to pending reviews
        unsubscribers.push(window.db.collection('exam_submissions').where('status', '==', 'pending').onSnapshot(snapshot => {
            statsData.pendingReviews = snapshot.size;
            updateCallback();
        }));

        // Listen to pending payments
        unsubscribers.push(window.db.collection('payment_requests').where('status', '==', 'pending').onSnapshot(snapshot => {
            statsData.pendingPayments = snapshot.size;
            updateCallback();
        }));

        // Listen to categories
        unsubscribers.push(window.db.collection('categories').onSnapshot(snapshot => {
            statsData.categories = snapshot.size;
            updateCallback();
        }));

        // Listen to certificates
        unsubscribers.push(window.db.collection('certificates').onSnapshot(snapshot => {
            statsData.certificates = snapshot.size;
            updateCallback();
        }));

        // Listen to contacts
        unsubscribers.push(window.db.collection('contacts').onSnapshot(snapshot => {
            statsData.contacts = snapshot.size;
            updateCallback();
        }));

        // Return a function to unsubscribe from all listeners
        return () => unsubscribers.forEach(unsub => unsub());
    },

    // System Settings
    async getSystemStatus() {
        try {
            const doc = await window.db.collection('settings').doc('system').get();
            if (doc.exists) return doc.data().status; // 'online' or 'offline'
            return 'online'; // Default
        } catch (e) {
            console.error("Error getting system status:", e);
            return 'online';
        }
    },

    async setSystemStatus(status, reason = '') {
        // status: 'online' | 'offline'
        // reason: text description of why it's offline
        return await window.db.collection('settings').doc('system').set({ status, reason }, { merge: true });
    },

    async getSiteSettings() {
        try {
            const doc = await window.db.collection('settings').doc('general').get();
            return doc.exists ? doc.data() : null;
        } catch (e) {
            console.error("Error getting site settings:", e);
            return null;
        }
    },

    async saveSiteSettings(settings) {
        try {
            await window.db.collection('settings').doc('general').set(settings, { merge: true });
            return true;
        } catch (e) {
            console.error("Error saving site settings:", e);
            throw e;
        }
    },

    async getGridifyPortalDetails() {
        try {
            const doc = await window.db.collection('settings').doc('gridify_portal').get();
            return doc.exists ? doc.data().content : '';
        } catch (e) {
            console.error("Error getting gridify portal details:", e);
            return '';
        }
    },

    async saveGridifyPortalDetails(content) {
        try {
            await window.db.collection('settings').doc('gridify_portal').set({ content }, { merge: true });
            return true;
        } catch (e) {
            console.error("Error saving gridify portal details:", e);
            throw e;
        }
    },

    // User Management
    async updateUserStatus(uid, status) {
        // status: 'active' | 'suspended'
        await window.db.collection('users').doc(uid).update({ status });

        // Notify User
        await this.addNotification(uid, {
            title: status === 'suspended' ? 'Account Suspended' : 'Account Re-activated',
            message: status === 'suspended'
                ? 'Your account has been suspended by an administrator.'
                : 'Great news! Your account has been re-activated.',
            type: status === 'suspended' ? 'error' : 'success',
            link: 'dashboard/index.html'
        });
        return true;
    },

    async updateUser(uid, data) {
        // data: { name, role, email (read-only usually but we might allow updating DB record), etc }
        await window.db.collection('users').doc(uid).update(data);

        // Notify User about role change
        if (data.role) {
            await this.addNotification(uid, {
                title: 'Role Updated',
                message: `Your account role has been updated to: ${data.role}`,
                type: 'info',
                link: 'dashboard/index.html'
            });
        }
        return true;
    },

    async deleteUser(uid) {
        // Note: This only deletes DB record. Auth record deletion requires Cloud Functions or Admin SDK.
        return await window.db.collection('users').doc(uid).delete();
    },

    // --- Student Operations ---
    async enrollUserInCourse(userId, courseId) {
        try {
            // Fetch Course Data to check if premium
            const courseDoc = await window.db.collection('courses').doc(courseId).get();
            if (!courseDoc.exists) throw new Error("Course not found");
            const course = courseDoc.data();

            const userRef = window.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw new Error("User not found");

            const userData = userDoc.data();
            let enrolled = userData.enrolledCourses || [];

            if (enrolled.includes(courseId)) return { success: false, message: 'Already enrolled' };

            // Check if course is premium and has a price
            const isPremium = course.isPremium && course.price > 0;

            if (isPremium) {
                // Check if there's already a pending request
                const existing = await window.db.collection('payment_requests')
                    .where('uid', '==', userId)
                    .where('courseId', '==', courseId)
                    .where('status', '==', 'pending')
                    .get();

                if (!existing.empty) return { success: false, message: 'Payment verification pending' };

                // Create payment request
                await window.db.collection('payment_requests').add({
                    uid: userId,
                    userName: userData.name || 'Student',
                    userEmail: userData.email,
                    courseId: courseId,
                    courseTitle: course.title,
                    price: course.price,
                    status: 'pending',
                    createdAt: new Date()
                });

                return { success: true, pendingVerification: true, message: 'Enrollment request sent. Waiting for payment verification.' };
            }

            // Free course logic
            enrolled.push(courseId);
            await userRef.update({ enrolledCourses: enrolled });
            return { success: true };
        } catch (e) {
            console.error("Enrollment Error:", e);
            throw e;
        }
    },

    async getPendingPayments() {
        try {
            const snapshot = await window.db.collection('payment_requests')
                .where('status', '==', 'pending')
                .get();
            const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory
            return payments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        } catch (e) {
            console.error("Error getting pending payments:", e);
            return [];
        }
    },

    async getApprovedPayments() {
        try {
            const snapshot = await window.db.collection('payment_requests')
                .where('status', '==', 'approved')
                .get();
            const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by approval date in memory
            return payments.sort((a, b) => (b.approvedAt?.seconds || 0) - (a.approvedAt?.seconds || 0));
        } catch (e) {
            console.error("Error getting approved payments:", e);
            return [];
        }
    },

    listenToPendingPayments(callback) {
        return window.db.collection('payment_requests')
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort in memory
                payments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                callback(payments);
            }, error => console.error("Error listening to payments:", error));
    },

    async approvePayment(paymentId, approvalData) {
        // approvalData: { paymentMode, collectedBy, adminUid, adminName }
        try {
            const batch = window.db.batch();
            const payRef = window.db.collection('payment_requests').doc(paymentId);
            const payDoc = await payRef.get();
            if (!payDoc.exists) throw new Error("Payment request not found");

            const payData = payDoc.data();

            // 1. Update Payment Status
            batch.update(payRef, {
                ...approvalData,
                status: 'approved',
                approvedAt: new Date()
            });

            // 2. Add course to user's enrolledCourses
            const userRef = window.db.collection('users').doc(payData.uid);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                const enrolled = userDoc.data().enrolledCourses || [];
                if (!enrolled.includes(payData.courseId)) {
                    enrolled.push(payData.courseId);
                    batch.update(userRef, { enrolledCourses: enrolled });
                }
            }

            // 3. Notify Student
            await this.addNotification(payData.uid, {
                title: 'Enrolled Successfully! 🎓',
                message: `Your payment for ${payData.courseTitle} has been approved. You can now start learning!`,
                type: 'success',
                link: 'dashboard/index.html'
            });

            await batch.commit();
            return true;
        } catch (e) {
            console.error("Approval Error:", e);
            throw e;
        }
    },

    async rejectPayment(paymentId, rejectionData) {
        // rejectionData: { reason, rejectedBy, adminUid, adminName }
        try {
            const payRef = window.db.collection('payment_requests').doc(paymentId);
            const payDoc = await payRef.get();
            if (!payDoc.exists) throw new Error("Payment request not found");

            const payData = payDoc.data();

            // 1. Update Payment Status
            await payRef.update({
                ...rejectionData,
                status: 'rejected',
                rejectedAt: new Date()
            });

            // 2. Notify Student
            await this.addNotification(payData.uid, {
                title: 'Payment Request Rejected ❌',
                message: `Your payment request for ${payData.courseTitle} has been rejected. Reason: ${rejectionData.reason || 'Not specified'}`,
                type: 'error',
                link: 'dashboard/index.html'
            });

            return true;
        } catch (e) {
            console.error("Rejection Error:", e);
            throw e;
        }
    },

    async getPaymentRequests(uid) {
        try {
            const snapshot = await window.db.collection('payment_requests')
                .where('uid', '==', uid)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            return [];
        }
    },

    listenToPaymentRequests(uid, callback) {
        return window.db.collection('payment_requests')
            .where('uid', '==', uid)
            .onSnapshot(snapshot => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(requests);
            }, error => console.error("Error listening to payment requests:", error));
    },

    async unenrollUserFromCourse(userId, courseId) {
        try {
            const userRef = window.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw new Error("User not found");

            const userData = userDoc.data();
            let enrolled = userData.enrolledCourses || [];

            if (!enrolled.includes(courseId)) return { success: true }; // Already not enrolled

            // Remove course ID
            enrolled = enrolled.filter(id => id !== courseId);

            await userRef.update({ enrolledCourses: enrolled });
            return { success: true };
        } catch (e) {
            console.error("Unenrollment Error:", e);
            throw e;
        }
    },

    async getUserEnrolledCourses(userId) {
        try {
            const userDoc = await window.db.collection('users').doc(userId).get();
            if (!userDoc.exists) return [];

            const data = userDoc.data();
            const enrolledIds = (data && data.enrolledCourses) ? data.enrolledCourses : [];
            if (enrolledIds.length === 0) return [];

            const allCourses = await this.getCourses();
            return allCourses.filter(c => enrolledIds.includes(c.id));
        } catch (e) {
            console.error("Fetch Enrolled Error:", e);
            throw e;
        }
    },

    listenToUserEnrolledCourses(userId, callback) {
        // Listen to both user document (for enrollment changes) and courses collection
        const unsubscribers = [];
        let enrolledIds = [];
        let allCourses = [];

        const updateCallback = () => {
            const enrolledCourses = allCourses.filter(c => enrolledIds.includes(c.id));
            callback(enrolledCourses);
        };

        // Listen to user's enrolled courses
        unsubscribers.push(window.db.collection('users').doc(userId).onSnapshot(snapshot => {
            if (snapshot.exists) {
                const data = snapshot.data();
                enrolledIds = (data && data.enrolledCourses) ? data.enrolledCourses : [];
                updateCallback();
            }
        }, error => console.error("Error listening to user enrollments:", error)));

        // Listen to all courses
        unsubscribers.push(window.db.collection('courses').onSnapshot(snapshot => {
            allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCallback();
        }, error => console.error("Error listening to courses:", error)));

        // Return unsubscribe function
        return () => unsubscribers.forEach(unsub => unsub());
    },

    // Stub for Exam Submissions (To be implemented fully later)
    async submitExam(submissionData) {
        try {
            // submissionData: { uid, courseId, itemId, answers: [], status: 'pending', submittedAt: Date }
            return await window.db.collection('exam_submissions').add({
                ...submissionData,
                submittedAt: new Date(),
                status: 'pending'
            });
        } catch (e) {
            console.error("Submit Exam Error:", e);
            throw e;
        }
    },

    async getExamSubmissions(uid, courseId, itemId) {
        try {
            const snapshot = await window.db.collection('exam_submissions')
                .where('uid', '==', uid)
                .where('courseId', '==', courseId)
                .where('itemId', '==', itemId)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            return [];
        }
    },

    async getPendingSubmissions() {
        try {
            const snapshot = await window.db.collection('exam_submissions')
                .where('status', '==', 'pending')
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            return [];
        }
    },

    listenToPendingSubmissions(callback) {
        return window.db.collection('exam_submissions')
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(subs);
            }, error => console.error("Error listening to submissions:", error));
    },

    async reviewSubmission(subId, reviewData) {
        try {
            // reviewData: { score, totalPossible, passed, feedback, reviewedBy, reviewedAt }
            await window.db.collection('exam_submissions').doc(subId).update({
                ...reviewData,
                status: 'reviewed',
                reviewedAt: new Date()
            });

            const subDoc = await window.db.collection('exam_submissions').doc(subId).get();
            const sub = subDoc.data();

            // Notify Student
            await this.addNotification(sub.uid, {
                title: reviewData.passed ? 'Exam Passed! 🎉' : 'Exam Result Updated',
                message: `Your result for ${sub.itemTitle} in ${sub.courseTitle} is ready. Score: ${reviewData.score}/${reviewData.totalPossible}. ${reviewData.passed ? 'Great job!' : 'Please review feedback.'}`,
                type: reviewData.passed ? 'success' : 'info',
                link: 'dashboard/index.html'
            });

            // If passed, generate certificate
            if (reviewData.passed) {
                const certificateId = await this.generateCertificate({
                    uid: sub.uid,
                    userName: sub.userName,
                    courseId: sub.courseId,
                    courseTitle: sub.courseTitle,
                    score: reviewData.score,
                    totalPossible: reviewData.totalPossible,
                    date: new Date()
                });

                // Update submission with cert ID
                await window.db.collection('exam_submissions').doc(subId).update({ certificateId });

                // Add notification for certificate
                await this.addNotification(sub.uid, {
                    title: 'Certificate Issued! 🏆',
                    message: `Congratulations! Your certificate for ${sub.courseTitle} has been issued.`,
                    type: 'success',
                    link: `certificate.html?id=${certificateId}`
                });
            }
            return true;
        } catch (e) {
            console.error("Review Error:", e);
            return false;
        }
    },

    async generateCertificate(data) {
        try {
            // Generates a unique document ID: GRD-CERT-YYYYMMDD-HEX
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const randomPart = Math.random().toString(16).substring(2, 6).toUpperCase();
            const docId = `GRD-CERT-${dateStr}-${randomPart}`;

            const certData = {
                ...data,
                certificateId: docId,
                issuedAt: new Date()
            };

            await window.db.collection('certificates').doc(docId).set(certData);
            return docId;
        } catch (e) {
            console.error("Error generating certificate:", e);
            throw e;
        }
    },

    async getAllCertificates() {
        try {
            const snapshot = await window.db.collection('certificates').orderBy('issuedAt', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error getting certificates:", e);
            return [];
        }
    },

    listenToRecentCertificates(callback) {
        return window.db.collection('certificates').orderBy('issuedAt', 'desc').limit(5).onSnapshot(snapshot => {
            const certs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(certs);
        }, error => console.error("Error listening to certificates:", error));
    },

    listenToRecentPayments(callback) {
        // Includes both pending and approved for activity feed
        return window.db.collection('payment_requests').orderBy('createdAt', 'desc').limit(5).onSnapshot(snapshot => {
            const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(payments);
        }, error => console.error("Error listening to payments:", error));
    },

    async getCertificates(uid) {
        try {
            const snapshot = await window.db.collection('certificates')
                .where('uid', '==', uid)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            return [];
        }
    },

    listenToCertificates(uid, callback) {
        return window.db.collection('certificates')
            .where('uid', '==', uid)
            .onSnapshot(snapshot => {
                const certs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(certs);
            }, error => console.error("Error listening to certificates:", error));
    },

    async getCertificateById(certId) {
        try {
            const doc = await window.db.collection('certificates').doc(certId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (e) {
            return null;
        }
    },

    async getDuplicateCertificates() {
        try {
            const allCerts = await this.getAllCertificates();
            const groups = {}; // Key: uid_courseId
            const duplicates = [];

            allCerts.forEach(cert => {
                const key = `${cert.uid}_${cert.courseId}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(cert);
            });

            for (const key in groups) {
                if (groups[key].length > 1) {
                    duplicates.push({
                        uid: groups[key][0].uid,
                        userName: groups[key][0].userName,
                        courseId: groups[key][0].courseId,
                        courseTitle: groups[key][0].courseTitle,
                        certs: groups[key].sort((a, b) => (b.issuedAt?.seconds || 0) - (a.issuedAt?.seconds || 0)) // Newest first
                    });
                }
            }
            return duplicates;
        } catch (e) {
            console.error("Error finding duplicates:", e);
            return [];
        }
    },

    async revokeCertificate(certId, uid, courseTitle, reason = "Duplicate issuance detected.") {
        try {
            // 1. Delete the certificate record
            await window.db.collection('certificates').doc(certId).delete();

            // 2. Add notification to user
            await this.addNotification(uid, {
                title: 'Certificate Revoked ⚠️',
                message: `One of your certificates for ${courseTitle} has been revoked and removed. Reason: ${reason}`,
                type: 'error',
                link: 'dashboard/index.html'
            });

            return true;
        } catch (e) {
            console.error("Error revoking certificate:", e);
            throw e;
        }
    },

    async clearFailedSubmission(uid, courseId, itemId) {
        try {
            const snapshot = await window.db.collection('exam_submissions')
                .where('uid', '==', uid)
                .where('courseId', '==', courseId)
                .where('itemId', '==', itemId)
                .get();

            const batch = window.db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            return true;
        } catch (e) {
            return false;
        }
    },

    // --- Progress Tracking ---
    async saveCourseProgress(uid, courseId, data) {
        try {
            // content: { timestamp, duration, status: 'started'|'completed', percent }
            const docId = `${uid}_${courseId}`;
            await window.db.collection('course_progress').doc(docId).set({
                uid,
                courseId,
                ...data,
                lastUpdated: new Date()
            }, { merge: true });
        } catch (e) {
            console.error("Save Progress Error:", e);
        }
    },

    async getCourseProgress(uid, courseId) {
        try {
            const docId = `${uid}_${courseId}`;
            const doc = await window.db.collection('course_progress').doc(docId).get();
            return doc.exists ? doc.data() : null;
        } catch (e) {
            console.error("Get Progress Error:", e);
            return null;
        }
    },

    async getTotalWatchTime(uid) {
        try {
            const snapshot = await window.db.collection('course_progress')
                .where('uid', '==', uid)
                .get();
            let totalSeconds = 0;
            snapshot.forEach(doc => {
                totalSeconds += doc.data().watchTime || 0;
            });
            return totalSeconds;
        } catch (e) {
            console.error("Error getting total watch time:", e);
            return 0;
        }
    },

    listenToTotalWatchTime(uid, callback) {
        return window.db.collection('course_progress')
            .where('uid', '==', uid)
            .onSnapshot(snapshot => {
                let totalSeconds = 0;
                snapshot.forEach(doc => {
                    totalSeconds += doc.data().watchTime || 0;
                });
                callback(totalSeconds);
            }, error => console.error("Error listening to watch time:", error));
    },

    // --- Notification System ---
    async addNotification(uid, data) {
        try {
            await window.db.collection('notifications').add({
                uid,
                ...data,
                read: false,
                createdAt: new Date()
            });
            return true;
        } catch (e) {
            console.error("Error adding notification:", e);
            return false;
        }
    },

    listenToNotifications(uid, callback) {
        return window.db.collection('notifications')
            .where('uid', '==', uid)
            .limit(20)
            .onSnapshot(snapshot => {
                const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort in memory to avoid index requirements
                notifications.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                    const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                    return timeB - timeA;
                });
                callback(notifications);
            }, error => console.error("Error listening to notifications:", error));
    },

    async markNotificationAsRead(notifId) {
        try {
            await window.db.collection('notifications').doc(notifId).update({ read: true });
            return true;
        } catch (e) {
            console.error("Error marking notification as read:", e);
            return false;
        }
    },

    // --- Contact Messages ---
    async submitContactForm(data) {
        try {
            await window.db.collection('contacts').add({
                ...data,
                createdAt: new Date(),
                status: 'unread'
            });
            return true;
        } catch (e) {
            console.error("Error submitting contact form:", e);
            throw e;
        }
    },

    async getContacts() {
        try {
            const snapshot = await window.db.collection('contacts').orderBy('createdAt', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error getting contacts:", e);
            return [];
        }
    },

    listenToRecentContacts(callback) {
        return window.db.collection('contacts').orderBy('createdAt', 'desc').limit(5).onSnapshot(snapshot => {
            const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(contacts);
        }, error => console.error("Error listening to contacts:", error));
    },

    async markContactAsRead(contactId) {
        try {
            await window.db.collection('contacts').doc(contactId).update({ status: 'read' });
            return true;
        } catch (e) {
            console.error("Error marking contact as read:", e);
            return false;
        }
    },

    // --- Live Class ---
    async startLiveClass(data) {
        try {
            // data: { title, description, category, youtubeLink, startedBy, courseId (opt), courseTitle(opt) }

            // 1. Create new live class
            const newDocRef = window.db.collection('live_classes').doc();
            await newDocRef.set({
                ...data, // now includes courseId, courseTitle if selected
                status: 'active',
                startedAt: new Date()
            });

            // 2. Notify Enrolled Students (if course linked)
            if (data.courseId) {
                // Fetch enrollments query
                // Note: Index might be needed for courseId query if not existing. 
                // Usually 'enrollments' queries by 'studentId'. Querying by 'courseId' is reverse index.
                // Assuming we can do simple where query.
                const enrollmentsSnap = await window.db.collection('enrollments')
                    .where('courseId', '==', data.courseId)
                    .get();

                if (!enrollmentsSnap.empty) {
                    const batch = window.db.batch();
                    const now = new Date();
                    let count = 0;

                    enrollmentsSnap.forEach(doc => {
                        const enrollment = doc.data();
                        if (enrollment.studentId && count < 490) { // Limit to batch size safety
                            const notifRef = window.db.collection('notifications').doc();
                            batch.set(notifRef, {
                                uid: enrollment.studentId,
                                title: "Live Class Started!",
                                message: `Live stream for "${data.courseTitle || 'your course'}" has started: ${data.title}`,
                                type: 'live_class',
                                link: '#', // TODO: Deep link if possible, or just dashboard
                                createdAt: now,
                                read: false
                            });
                            count++;
                        }
                    });

                    if (count > 0) {
                        try {
                            await batch.commit();
                            console.log(`Notified ${count} students.`);
                        } catch (err) {
                            console.error("Failed to send notifications batch:", err);
                        }
                    }
                }
            }

            return { success: true, id: newDocRef.id };
        } catch (e) {
            console.error("Error starting live class:", e);
            throw e;
        }
    },

    async endLiveClass(uid) {
        try {
            let query = window.db.collection('live_classes').where('status', '==', 'active');

            // If uid provided, only end sessions started by that user
            if (uid) {
                query = query.where('startedBy', '==', uid);
            }

            const activeSnaps = await query.get();

            const batch = window.db.batch();
            activeSnaps.forEach(doc => {
                batch.update(doc.ref, { status: 'ended', endedAt: new Date() });
            });
            await batch.commit();
            return true;
        } catch (e) {
            console.error("Error ending live class:", e);
            throw e;
        }
    },

    async getActiveLiveClass() {
        try {
            // Get the most recent active class (for main banner)
            // Removed orderBy to avoid index issues. We sort in memory.
            const snapshot = await window.db.collection('live_classes')
                .where('status', '==', 'active')
                .get();

            if (snapshot.empty) return null;

            // Sort to find newest
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => {
                const tA = a.startedAt ? (a.startedAt.seconds || 0) : 0;
                const tB = b.startedAt ? (b.startedAt.seconds || 0) : 0;
                return tB - tA;
            });

            return docs[0]; // Most recent
        } catch (e) {
            console.error("Error getting live class:", e);
            return null;
        }
    },

    async getAllActiveLiveClasses() {
        try {
            const snapshot = await window.db.collection('live_classes')
                .where('status', '==', 'active')
                .get();

            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory to avoid index requirement
            sessions.sort((a, b) => {
                const tA = a.startedAt ? (a.startedAt.seconds || 0) : 0;
                const tB = b.startedAt ? (b.startedAt.seconds || 0) : 0;
                return tB - tA;
            });
            return sessions;
        } catch (e) {
            console.error("Error getting all live classes:", e);
            return [];
        }
    },

    listenToActiveLiveClasses(callback) {
        return window.db.collection('live_classes')
            .where('status', '==', 'active')
            .onSnapshot(snapshot => {
                const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort in memory
                sessions.sort((a, b) => {
                    const tA = a.startedAt ? (a.startedAt.seconds || 0) : 0;
                    const tB = b.startedAt ? (b.startedAt.seconds || 0) : 0;
                    return tB - tA;
                });
                callback(sessions);
            }, error => console.error("Error listening to live classes:", error));
    },

    async getUserActiveLiveClass(uid) {
        try {
            const snapshot = await window.db.collection('live_classes')
                .where('status', '==', 'active')
                .where('startedBy', '==', uid)
                .limit(1)
                .get();

            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        } catch (e) {
            console.error("Error getting user live class:", e);
            return null;
        }
    },

    // --- Live Chat Functions ---
    async sendLiveMessage(liveId, messageData) {
        try {
            await window.db.collection('live_chats').add({
                liveId: liveId,
                ...messageData,
                timestamp: new Date()
            });
            return true;
        } catch (e) {
            console.error("Chat send error:", e);
            return false;
        }
    },

    onLiveChatUpdates(liveId, callback) {
        return window.db.collection('live_chats')
            .where('liveId', '==', liveId)
            // .orderBy('timestamp', 'asc') // Removing to prevent index error
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort in memory
                messages.sort((a, b) => {
                    const tA = a.timestamp ? (a.timestamp.seconds || 0) : 0;
                    const tB = b.timestamp ? (b.timestamp.seconds || 0) : 0;
                    return tA - tB;
                });
                callback(messages);
            }, error => {
                console.log("Chat listener warning:", error);
            });
    },

    async deleteContact(contactId) {
        try {
            await window.db.collection('contacts').doc(contactId).delete();
            return true;
        } catch (e) {
            console.error("Error deleting contact:", e);
            return false;
        }
    },

    // --- Legal Pages Management ---
    async getPrivacyPolicy() {
        try {
            const doc = await window.db.collection('settings').doc('privacy_policy').get();
            return doc.exists ? doc.data().content : null;
        } catch (e) {
            console.error("Error getting privacy policy:", e);
            return null;
        }
    },

    async savePrivacyPolicy(content) {
        try {
            await window.db.collection('settings').doc('privacy_policy').set({
                content,
                updatedAt: new Date()
            }, { merge: true });
            return true;
        } catch (e) {
            console.error("Error saving privacy policy:", e);
            throw e;
        }
    },

    async getTermsOfService() {
        try {
            const doc = await window.db.collection('settings').doc('terms_of_service').get();
            return doc.exists ? doc.data().content : null;
        } catch (e) {
            console.error("Error getting terms of service:", e);
            return null;
        }
    },

    async saveTermsOfService(content) {
        try {
            await window.db.collection('settings').doc('terms_of_service').set({
                content,
                updatedAt: new Date()
            }, { merge: true });
            return true;
        } catch (e) {
            console.error("Error saving terms of service:", e);
            throw e;
        }
    }
};

window.DB = DB;
