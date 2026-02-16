document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const categoryContainer = document.querySelector('.ul-categories .row');

    if (!categoryContainer) return;

    async function loadPublicCategories() {
        const { data, error } = await client
            .from('categories')
            .select('*')
            .eq('is_visible', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching categories:', error);
            return;
        }

        if (data.length > 0) {
            renderPublicCategories(data);
        }
    }

    function renderPublicCategories(categories) {
        categoryContainer.innerHTML = categories.map((cat, index) => {
            // Use the image_url from database, fallback to placeholder if not provided
            const imgPath = cat.image_url || `assets/img/category-${(index % 7) + 1}.jpg`;

            return `
                <div class="col">
                    <a class="ul-category" href="shop.html?category=${encodeURIComponent(cat.name)}">
                        <div class="ul-category-img">
                            <img src="${imgPath}" alt="${cat.name}">
                        </div>
                        <div class="ul-category-txt">
                            <span>${cat.name}</span>
                        </div>
                        <div class="ul-category-btn">
                            <span><i class="flaticon-arrow-point-to-right"></i></span>
                        </div>
                    </a>
                </div>
            `;
        }).join('');
    }

    loadPublicCategories();
});
