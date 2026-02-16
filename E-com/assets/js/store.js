<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Store - House of Pachu</title>
    <link rel="shortcut icon" href="assets/img/logo.png" type="image/png">

    <!-- libraries CSS -->
    <link rel="stylesheet" href="assets/icon/flaticon_glamer.css">
    <link rel="stylesheet" href="assets/vendor/bootstrap/bootstrap.min.css">
    <link rel="stylesheet" href="assets/vendor/splide/splide.min.css">
    <link rel="stylesheet" href="assets/vendor/swiper/swiper-bundle.min.css">
    <link rel="stylesheet" href="assets/vendor/slim-select/slimselect.css">
    <link rel="stylesheet" href="assets/vendor/animate-wow/animate.min.css">

    <!-- custom CSS -->
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/skeleton.css">

    <!-- Supabase -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="assets/js/supabase-config.js"></script>

    <style>
        .store-header {
            padding: 120px 0 80px;
            background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
            color: white;
            position: relative;
            overflow: hidden;
            border-radius: 0 0 50px 50px;
        }

        .store-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1920') center/cover no-repeat;
            opacity: 0.2;
            z-index: 0;
        }

        .store-header-content {
            position: relative;
            z-index: 1;
        }



        .store-name {
            font-size: clamp(2.5rem, 8vw, 4rem);
            font-weight: 900;
            margin-bottom: 10px;
            letter-spacing: -1px;
            line-height: 1.1;
        }

        .store-meta {
            display: flex;
            gap: 25px;
            flex-wrap: wrap;
            font-size: 1rem;
            opacity: 0.9;
        }

        .store-meta-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .store-meta-item i {
            color: var(--ul-primary);
        }

        .product-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 30px;
            margin-bottom: 80px;
        }

        .shop-filter-bar {
            background: #fff;
            padding: 20px 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            margin-bottom: 40px;
            margin-top: -40px;
            position: relative;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
            border: 1px solid #eee;
        }

        .filter-group {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .filter-label {
            font-size: 0.95rem;
            font-weight: 600;
            color: #495057;
            margin-bottom: 0;
        }

        .custom-select {
            padding: 10px 20px;
            border-radius: 12px;
            border: 1px solid #ddd;
            font-size: 0.9rem;
            color: #212529;
            background-color: #f8f9fa;
            cursor: pointer;
            outline: none;
            transition: all 0.3s;
        }

        .results-count {
            font-weight: 500;
            color: #666;
            font-size: 0.95rem;
        }

        .no-products {
            padding: 100px 0;
            text-align: center;
        }

        .no-products i {
            font-size: 4rem;
            color: #dee2e6;
            margin-bottom: 20px;
            display: block;
        }

        /* Mobile Responsive Fixes */
        @media (max-width: 991px) {
            .store-header {
                padding: 100px 0 60px;
                text-align: center;
            }

            .store-header-content .breadcrumb {
                justify-content: center;
            }

            .mobile-header-flex {
                justify-content: center;
                flex-direction: column;
                gap: 15px !important;
            }



            .store-meta {
                justify-content: center;
                gap: 15px 25px;
            }
        }

        @media (max-width: 767px) {
            .store-header {
                padding: 80px 0 50px;
                border-radius: 0 0 30px 30px;
            }

            .shop-filter-bar {
                margin-top: -25px;
                padding: 15px 20px;
                flex-direction: column;
                align-items: stretch;
                text-align: center;
            }

            .filter-group {
                justify-content: center;
            }

            .product-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }

            .ul-product-title {
                font-size: 0.9rem !important;
            }

            .ul-product-price {
                font-size: 1rem !important;
            }
        }

        @media (max-width: 480px) {
            .product-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .store-meta {
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }

            .store-header {
                padding: 70px 0 40px;
            }
        }
    </style>
</head>

<body>

    <div id="sidebar-placeholder"></div>
    <div id="header-placeholder"></div>

    <main>
        <!-- Store Header -->
        <section class="store-header">
            <div class="ul-container">
                <div class="ul-inner-container store-header-content">
                    <nav aria-label="breadcrumb">
                        <ol class="breadcrumb">
                            <li class="breadcrumb-item"><a href="index.html"
                                    class="text-white opacity-75 text-decoration-none">Home</a></li>
                            <li class="breadcrumb-item text-white opacity-75">Sellers</li>
                            <li class="breadcrumb-item active text-white" aria-current="page"
                                id="breadcrumb-store-name">Store</li>
                        </ol>
                    </nav>

                    <div class="d-flex align-items-center gap-4 flex-wrap mobile-header-flex">

                        <div class="store-info-text">
                            <h1 class="store-name" id="store-display-name">Loading Store...</h1>
                            <div class="store-meta">
                                <span class="store-meta-item">
                                    <i class="flaticon-location"></i>
                                    <span id="store-state">...</span>
                                </span>
                                <span class="store-meta-item">
                                    <i class="flaticon-placeholder"></i>
                                    PIN: <span id="store-pincode">...</span>
                                </span>
                                <span class="store-meta-item">
                                    <i class="flaticon-sparkle"></i>
                                    Since <span id="store-since">...</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Products Section -->
        <div class="ul-container">
            <section class="ul-inner-container">
                <!-- Filter Bar -->
                <div class="shop-filter-bar shadow-sm">
                    <div class="filter-group">
                        <div class="d-flex align-items-center gap-3">
                            <label class="filter-label">Sort By:</label>
                            <select id="sort-select" class="custom-select">
                                <option value="newest">Newest Arrivals</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="oldest">Oldest</option>
                            </select>
                        </div>
                    </div>
                    <div class="results-count">
                        <span id="store-product-count">0</span> products from this store
                    </div>
                </div>

                <div id="products-loading" class="product-grid">
                    <!-- Skeletons -->
                    <div class="ul-product skeleton">
                        <div class="ul-product-img"></div>
                        <div class="ul-product-title"></div>
                        <div class="ul-product-category"></div>
                        <div class="ul-product-price"></div>
                    </div>
                    <div class="ul-product skeleton">
                        <div class="ul-product-img"></div>
                        <div class="ul-product-title"></div>
                        <div class="ul-product-category"></div>
                        <div class="ul-product-price"></div>
                    </div>
                    <div class="ul-product skeleton">
                        <div class="ul-product-img"></div>
                        <div class="ul-product-title"></div>
                        <div class="ul-product-category"></div>
                        <div class="ul-product-price"></div>
                    </div>
                    <div class="ul-product skeleton">
                        <div class="ul-product-img"></div>
                        <div class="ul-product-title"></div>
                        <div class="ul-product-category"></div>
                        <div class="ul-product-price"></div>
                    </div>
                </div>

                <div id="products-grid" class="product-grid" style="display: none;">
                    <!-- Products will be loaded here -->
                </div>

                <div id="no-products" class="no-products" style="display: none;">
                    <i class="flaticon-shopping-bag"></i>
                    <h3>No products found</h3>
                    <p class="text-muted">This store hasn't uploaded any products yet.</p>
                    <a href="shop.html" class="ul-btn mt-3">Browse Other Stores</a>
                </div>
            </section>
        </div>
    </main>

    <div id="footer-placeholder"></div>

    <!-- libraries JS -->
    <script src="assets/vendor/bootstrap/bootstrap.bundle.min.js"></script>
    <script src="assets/vendor/splide/splide.min.js"></script>
    <script src="assets/vendor/splide/splide-extension-auto-scroll.min.js"></script>
    <script src="assets/vendor/swiper/swiper-bundle.min.js"></script>
    <script src="assets/vendor/slim-select/slimselect.min.js"></script>
    <script src="assets/vendor/animate-wow/wow.min.js"></script>
    <script src="assets/vendor/fslightbox/fslightbox.js"></script>

    <!-- custom JS -->
    <script src="assets/js/common-loader.js"></script>
    <script src="assets/js/main.js"></script>
    <script src="assets/js/store.js"></script>
</body>

</html>
