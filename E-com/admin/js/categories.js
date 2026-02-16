document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const categoryList = document.getElementById('category-list');
    const categoryForm = document.getElementById('category-form');
    const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
    const modalTitle = document.getElementById('categoryModalTitle');
    const categoryIdInput = document.getElementById('category-id');
    const categoryNameInput = document.getElementById('category-name');
    const categoryDescInput = document.getElementById('category-description');
    const categoryImageInput = document.getElementById('category-image');
    const categoryVisibilityInput = document.getElementById('category-visibility');

    let allCategories = [];

    // Fetch and display categories
    async function loadCategories() {
        categoryList.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2">Loading categories...</span>
                </td>
            </tr>
        `;

        const { data, error } = await client
            .from('categories')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching categories:', error);
            categoryList.innerHTML = `<tr><td colspan="5" class="empty-state text-danger">Error loading categories. Please check database.</td></tr>`;
            return;
        }

        allCategories = data;
        renderCategories(data);
    }

    function renderCategories(categories) {
        if (categories.length === 0) {
            categoryList.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="package-open"></i>
                        <p>No categories found. Start by adding one!</p>
                    </td>
                </tr>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        categoryList.innerHTML = categories.map(cat => `
            <tr>
                <td>
                    <div class="category-name">${cat.name}</div>
                </td>
                <td>
                    <div class="text-muted small">${cat.description || 'No description'}</div>
                </td>
                <td>
                    <span class="badge ${cat.is_visible ? 'badge-success' : 'badge-secondary'}">
                        ${cat.is_visible ? 'Visible' : 'Hidden'}
                    </span>
                </td>
                <td>
                    <div class="text-muted small">${new Date(cat.created_at).toLocaleDateString()}</div>
                </td>
                <td>
                    <div class="action-btns justify-content-end">
                        <button class="btn-icon edit-btn" data-id="${cat.id}" title="Edit">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-icon toggle-visibility-btn" data-id="${cat.id}" data-visible="${cat.is_visible}" title="${cat.is_visible ? 'Hide' : 'Show'}">
                            <i data-lucide="${cat.is_visible ? 'eye-off' : 'eye'}"></i>
                        </button>
                        <button class="btn-icon delete delete-btn" data-id="${cat.id}" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
        attachEventListeners();
    }

    function attachEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const cat = allCategories.find(c => c.id === id);
                if (cat) {
                    modalTitle.textContent = 'Edit Category';
                    categoryIdInput.value = cat.id;
                    categoryNameInput.value = cat.name;
                    categoryDescInput.value = cat.description || '';
                    categoryImageInput.value = cat.image_url || '';
                    categoryVisibilityInput.checked = cat.is_visible;
                    categoryModal.show();
                }
            });
        });

        // Toggle visibility
        document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const isVisible = btn.getAttribute('data-visible') === 'true';

                const { error } = await client
                    .from('categories')
                    .update({ is_visible: !isVisible })
                    .eq('id', id);

                if (error) {
                    showAlert('Error updating visibility: ' + error.message, 'error');
                } else {
                    showAlert('Category visibility updated', 'success');
                    loadCategories();
                }
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                showConfirm('Are you sure you want to delete this category? Products in this category might become uncategorized.', async () => {
                    const { error } = await client
                        .from('categories')
                        .delete()
                        .eq('id', id);

                    if (error) {
                        showAlert('Error deleting category: ' + error.message, 'error');
                    } else {
                        showAlert('Category deleted successfully', 'success');
                        loadCategories();
                    }
                });
            });
        });
    }

    // Form Submission
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = categoryIdInput.value;
        const name = categoryNameInput.value;
        const description = categoryDescInput.value;
        const image_url = categoryImageInput.value;
        const is_visible = categoryVisibilityInput.checked;

        const categoryData = { name, description, image_url, is_visible };

        let result;
        if (id) {
            // Update
            result = await client
                .from('categories')
                .update(categoryData)
                .eq('id', id);
        } else {
            // Insert
            result = await client
                .from('categories')
                .insert([categoryData]);
        }

        if (result.error) {
            showAlert('Error saving category: ' + result.error.message, 'error');
        } else {
            showAlert('Category saved successfully', 'success');
            categoryModal.hide();
            categoryForm.reset();
            loadCategories();
        }
    });

    // Reset modal on close
    document.getElementById('categoryModal').addEventListener('hidden.bs.modal', () => {
        categoryForm.reset();
        categoryIdInput.value = '';
        modalTitle.textContent = 'Add New Category';
    });

    // Initial load
    loadCategories();
});
