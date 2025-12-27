
import { db } from '../assets/js/firebase-config.js';
import {
    collection, getDocs, doc, setDoc, deleteDoc, updateDoc,
    query, where, addDoc, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { AdminManager } from '../assets/js/admin-manager.js';

const NOTES_COLLECTION = 'imp_notes';

class ImpManager {
    constructor() {
        this.notes = [];
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Auth Check
        const session = AdminManager.getSession();
        if (!session || session.role !== 'admin') {
            window.location.href = '../login/index.html';
            return;
        }

        this.currentUser = session.username;

        // Hide loader after a brief delay
        setTimeout(() => $('#authOverlay').fadeOut(), 500);

        this.bindEvents();
        await this.loadNotes();
    }

    bindEvents() {
        $('#noteForm').on('submit', (e) => { e.preventDefault(); this.handleSave(); });
        $('#searchInput').on('input', () => this.renderNotes());
        $('#logoutBtn').on('click', () => AdminManager.logout());
    }

    async loadNotes() {
        try {
            const q = query(collection(db, NOTES_COLLECTION), orderBy('updatedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            this.notes = [];
            querySnapshot.forEach((doc) => {
                this.notes.push({ id: doc.id, ...doc.data() });
            });
            this.renderNotes();
        } catch (e) {
            console.error("Load Notes Error:", e);
            $('#notesGrid').html(`<div class="col-12 text-center text-danger"><i class="fas fa-exclamation-triangle mt-5"></i> Failed to load notes.</div>`);
        }
    }

    renderNotes() {
        const search = $('#searchInput').val().toLowerCase();
        const container = $('#notesGrid').empty();

        const filtered = this.notes.filter(n =>
            n.title.toLowerCase().includes(search) ||
            (n.content && n.content.toLowerCase().includes(search))
        );

        if (filtered.length === 0) {
            if (this.notes.length === 0 && search === '') {
                container.html(`
                    <div class="col-12 text-center py-5">
                        <div class="mb-3 opacity-25"><i class="fas fa-sticky-note fa-3x"></i></div>
                        <h5 class="fw-700">No notes yet</h5>
                        <p class="text-slate">Click "Add Note" to create one.</p>
                    </div>
                `);
            } else {
                container.html(`
                    <div class="col-12 text-center py-5">
                        <h5 class="fw-700 text-muted">No matching notes found</h5>
                    </div>
                `);
            }
            return;
        }

        filtered.forEach(note => {
            // Updated Card Design: Only Show ID and Title
            const isAuthor = note.createdBy === this.currentUser;
            const editBtnClass = isAuthor ? '' : 'd-none'; // Hide edit/delete if not author? User said "allow only author to edit". Delete usually follows suit.

            // To be safe, I'm disabling the buttons visually or hiding them.
            // But let's keep them visible but standard "disabled" or handle in click.
            // Actually cleaner to just hide them if they can't use them, OR show them but show alert.
            // Requirements: "only allow the auter to edit".

            const html = `
                <div class="col-md-6 col-lg-4">
                    <div class="note-card cursor-pointer" onclick="window.viewNote('${note.id}')">
                        <div class="small text-muted mb-1 text-uppercase" style="font-size: 0.7rem; letter-spacing: 1px;">
                            ID: ${note.id.substring(0, 8)}...
                        </div>
                        <h5 class="note-title mb-0 text-truncate" title="${this.escapeHtml(note.title)}">${this.escapeHtml(note.title)}</h5>
                        
                        <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center" onclick="event.stopPropagation();">
                            <small class="text-slate"><i class="far fa-user me-1"></i> ${this.escapeHtml(note.createdBy || 'Unknown')}</small>
                            <div class="d-flex gap-2">
                                <button class="action-btn ${isAuthor ? '' : 'opacity-25'}" ${isAuthor ? '' : 'disabled'} onclick="window.editNote('${note.id}')" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-delete ${isAuthor ? '' : 'opacity-25'}" ${isAuthor ? '' : 'disabled'} onclick="window.deleteNote('${note.id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.append(html);
        });
    }

    async handleSave() {
        const id = $('#noteId').val();
        const data = {
            title: $('#noteTitle').val(),
            content: $('#noteContent').val(),
            updatedAt: new Date().toISOString(),
            createdBy: this.currentUser // Ensure creator is tracked
        };

        const btn = $('#noteForm button[type="submit"]');
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Saving...');

        try {
            if (id && id.trim() !== '') {
                // Update
                // Important: Existing 'createdAt' and 'createdBy' should persist.
                // We should only update specific fields if we want to be safe, but since we are loading valid data:
                // We need to fetch the existing doc to not overwrite createdAt if we don't have it in form (we don't).
                // Actually updateDoc only updates fields passed.

                // Security Check Again (Frontend)
                const existing = this.notes.find(n => n.id === id);
                if (existing && existing.createdBy !== this.currentUser) {
                    throw new Error("Unauthorized to edit this note.");
                }

                await updateDoc(doc(db, NOTES_COLLECTION, id), {
                    title: data.title,
                    content: data.content,
                    updatedAt: data.updatedAt
                });

            } else {
                // Create with Custom ID
                const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                const customId = `GRD-NOTE-${randomId}`;

                data.createdAt = new Date().toISOString();
                await setDoc(doc(db, NOTES_COLLECTION, customId), data);
            }
            bootstrap.Modal.getInstance(document.getElementById('noteModal')).hide();
            await this.loadNotes();
        } catch (e) {
            console.error("Save Error:", e);
            alert("Failed to save note: " + e.message);
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    }

    async deleteNote(id) {
        // Security Check
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        if (note.createdBy !== this.currentUser) {
            alert("Only the author can delete this note.");
            return;
        }

        if (!confirm("Are you sure you want to delete this note?")) return;
        try {
            await deleteDoc(doc(db, NOTES_COLLECTION, id));
            await this.loadNotes();
        } catch (e) {
            console.error("Delete Error:", e);
            alert("Failed to delete note.");
        }
    }

    escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    resetForm() {
        $('#noteId').val('');
        $('#noteForm')[0].reset();
        $('#modalTitle').text('Add Important Note');
    }
}

const manager = new ImpManager();

// Window Globals
window.resetNoteForm = () => manager.resetForm();

window.viewNote = (id) => {
    const note = manager.notes.find(n => n.id === id);
    if (!note) return;

    $('#viewNoteTitle').text(note.title);
    $('#viewNoteIdDisplay').text(`ID: ${note.id}`);
    $('#viewNoteContent').text(note.content); // Use text() to prevent XSS, CSS white-space handles newlines
    $('#viewNoteAuthor').text(note.createdBy || 'Unknown');

    // Dates
    const created = note.createdAt ? new Date(note.createdAt).toLocaleString() : 'N/A';
    const updated = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : 'N/A';

    $('#viewNoteCreated').text(created);
    $('#viewNoteModified').text(updated);

    new bootstrap.Modal(document.getElementById('viewNoteModal')).show();
}

window.editNote = (id) => {
    const note = manager.notes.find(n => n.id === id);
    if (!note) return;

    if (note.createdBy !== manager.currentUser) {
        alert("Permission Denied: Only the author can edit this note.");
        return;
    }

    $('#modalTitle').text('Edit Important Note');
    $('#noteId').val(note.id);
    $('#noteTitle').val(note.title);
    $('#noteContent').val(note.content);
    new bootstrap.Modal(document.getElementById('noteModal')).show();
};

window.deleteNote = (id) => manager.deleteNote(id);
