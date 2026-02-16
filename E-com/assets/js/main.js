document.addEventListener("DOMContentLoaded", (event) => {
    // preloader
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.display = 'none';
        document.body.style.position = 'static';
        document.body.style.overflow = 'visible';
    }

    function initializeGlobalComponents() {
        // HEADER NAV IN MOBILE
        if (document.querySelector(".ul-header-nav")) {
            const ulSidebar = document.querySelector(".ul-sidebar");
            const ulSidebarOpener = document.querySelector(".ul-header-sidebar-opener");
            const ulSidebarCloser = document.querySelector(".ul-sidebar-closer");
            const ulMobileMenuContent = document.querySelector(".to-go-to-sidebar-in-mobile");
            const ulHeaderNavMobileWrapper = document.querySelector(".ul-sidebar-header-nav-wrapper");
            const ulHeaderNavOgWrapper = document.querySelector(".ul-header-nav-wrapper");

            function updateMenuPosition() {
                if (window.innerWidth < 992 && ulHeaderNavMobileWrapper && ulMobileMenuContent) {
                    ulHeaderNavMobileWrapper.appendChild(ulMobileMenuContent);
                }

                if (window.innerWidth >= 992 && ulHeaderNavOgWrapper && ulMobileMenuContent) {
                    ulHeaderNavOgWrapper.appendChild(ulMobileMenuContent);
                }
            }

            updateMenuPosition();

            window.addEventListener("resize", () => {
                updateMenuPosition();
            });

            if (ulSidebarOpener && ulSidebar) {
                ulSidebarOpener.addEventListener("click", () => {
                    ulSidebar.classList.add("active");
                });
            }

            if (ulSidebarCloser && ulSidebar) {
                ulSidebarCloser.addEventListener("click", () => {
                    ulSidebar.classList.remove("active");
                });
            }


            // menu dropdown/submenu in mobile
            const ulHeaderNavMobile = document.querySelector(".ul-header-nav");
            if (ulHeaderNavMobile) {
                const ulHeaderNavMobileItems = ulHeaderNavMobile.querySelectorAll(".has-sub-menu");
                ulHeaderNavMobileItems.forEach((item) => {
                    item.addEventListener("click", () => {
                        if (window.innerWidth < 992) {
                            item.classList.toggle("active");
                        }
                    });
                });
            }
        }

        // Note: Header search logic and mobile toggles are now handled in common-loader.js

        if (document.querySelector(".ul-header-top-slider")) {
            const splideElement = document.querySelector('.ul-header-top-slider');
            if (splideElement && typeof Splide !== 'undefined') {
                const splide = new Splide('.ul-header-top-slider', {
                    arrows: false,
                    pagination: false,
                    type: 'loop',
                    drag: 'free',
                    focus: 'center',
                    autoWidth: true,
                    gap: 30,
                    autoScroll: {
                        speed: 1,
                        pauseOnHover: false,
                        pauseOnFocus: false,
                    },
                });

                // Detect Extensions
                const extensions = (window.Splide && window.Splide.Extensions) || (window.splide && window.splide.Extensions);

                if (extensions) {
                    splide.mount(extensions);
                } else {
                    splide.mount();
                }
            }
        }

        // Note: Header category and nav population is now handled in common-loader.js
        // to ensure it works consistently across all pages.

        // sidebar products slider
        const ulSidebarProductsSlider = document.querySelector(".ul-sidebar-products-slider");
        if (ulSidebarProductsSlider) {
            const slideCount = ulSidebarProductsSlider.querySelectorAll(".swiper-slide").length;
            new Swiper(".ul-sidebar-products-slider", {
                slidesPerView: 1,
                loop: slideCount > 3, // Max views is 2, need >3 slides for loop
                autoplay: true,
                spaceBetween: 30,
                navigation: {
                    nextEl: ".ul-sidebar-products-slider-nav .next",
                    prevEl: ".ul-sidebar-products-slider-nav .prev",
                },
                breakpoints: {
                    1400: {
                        slidesPerView: 2,
                    }
                }
            });
        }

        // GO TO TOP
        const goToTopButton = document.querySelector("#go-to-top");
        if (goToTopButton && !goToTopButton.dataset.listenerAdded) {
            window.addEventListener("scroll", () => {
                if (window.scrollY > 300) {
                    goToTopButton.classList.add("show");
                } else {
                    goToTopButton.classList.remove("show");
                }
            });

            goToTopButton.addEventListener("click", () => {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                });
            });
            goToTopButton.dataset.listenerAdded = "true";
        }
    }

    // Listen for common components loaded event
    document.addEventListener('commonComponentsLoaded', () => {
        console.log('Main.js: Common components loaded event received');
        initializeGlobalComponents();
    });

    // Also run immediately in case they are already there (static pages or cached fetches)
    if (window.commonComponentsLoaded) {
        console.log('Main.js: Common components already loaded, initializing...');
        initializeGlobalComponents();
    } else {
        // Still run once for static elements (preloader, etc)
        initializeGlobalComponents();
    }

    // The rest of the page-specific logic

    // banner image slider
    const ulBannerImgSlider = document.querySelector(".ul-banner-img-slider");
    let bannerThumbSlider;
    if (ulBannerImgSlider) {
        const slideCount = ulBannerImgSlider.querySelectorAll(".swiper-slide").length;
        bannerThumbSlider = new Swiper(".ul-banner-img-slider", {
            slidesPerView: 1.4,
            loop: slideCount > 1,
            autoplay: true,
            spaceBetween: 15,
            breakpoints: {
                992: {
                    spaceBetween: 15,
                },
                1680: {
                    spaceBetween: 26,
                },
                1700: {
                    spaceBetween: 30,
                }
            }
        });
    }


    // BANNER SLIDER
    const ulBannerSlider = document.querySelector(".ul-banner-slider");
    if (ulBannerSlider) {
        const slideCount = ulBannerSlider.querySelectorAll(".swiper-slide").length;
        const bannerSlider = new Swiper(".ul-banner-slider", {
            slidesPerView: 1,
            loop: slideCount > 1,
            autoplay: true,
            thumbs: {
                swiper: bannerThumbSlider,
            },
            navigation: {
                nextEl: ".ul-banner-slider-nav .next",
                prevEl: ".ul-banner-slider-nav .prev",
            },
        });
    }

    // products filtering 
    if (document.querySelector(".ul-filter-products-wrapper")) {
        mixitup('.ul-filter-products-wrapper');
    }


    // product slider
    const ulProductsSlider1 = document.querySelector(".ul-products-slider-1");
    if (ulProductsSlider1) {
        const slideCount = ulProductsSlider1.querySelectorAll(".swiper-slide").length;
        new Swiper(".ul-products-slider-1", {
            slidesPerView: 3,
            loop: slideCount >= 6, // Needs slidesPerView * 2 for stable loop
            autoplay: true,
            spaceBetween: 15,
            navigation: {
                nextEl: ".ul-products-slider-1-nav .next",
                prevEl: ".ul-products-slider-1-nav .prev",
            },
            breakpoints: {
                0: {
                    slidesPerView: 1,
                },
                480: {
                    slidesPerView: 2,
                },
                992: {
                    slidesPerView: 3,
                },
                1200: {
                    spaceBetween: 20,
                },
                1400: {
                    spaceBetween: 22,
                },
                1600: {
                    spaceBetween: 26,
                },
                1700: {
                    spaceBetween: 30,
                }
            }
        });
    }

    // product slider
    const ulProductsSlider2 = document.querySelector(".ul-products-slider-2");
    if (ulProductsSlider2) {
        const slideCount = ulProductsSlider2.querySelectorAll(".swiper-slide").length;
        new Swiper(".ul-products-slider-2", {
            slidesPerView: 3,
            loop: slideCount >= 6, // Needs slidesPerView * 2 for stable loop
            autoplay: true,
            spaceBetween: 15,
            navigation: {
                nextEl: ".ul-products-slider-2-nav .next",
                prevEl: ".ul-products-slider-2-nav .prev",
            },
            breakpoints: {
                0: {
                    slidesPerView: 1,
                },
                480: {
                    slidesPerView: 2,
                },
                992: {
                    slidesPerView: 3,
                },
                1200: {
                    spaceBetween: 20,
                },
                1400: {
                    spaceBetween: 22,
                },
                1600: {
                    spaceBetween: 26,
                },
                1700: {
                    spaceBetween: 30,
                }
            }
        });
    }

    // flash sale slider
    const ulFlashSaleSlider = document.querySelector(".ul-flash-sale-slider");
    if (ulFlashSaleSlider) {
        const slideCount = ulFlashSaleSlider.querySelectorAll(".swiper-slide").length;
        new Swiper(".ul-flash-sale-slider", {
            slidesPerView: 1,
            loop: slideCount >= 10, // Max views is 4.7, so 10 is safe
            autoplay: true,
            spaceBetween: 15,
            breakpoints: {
                480: {
                    slidesPerView: 2,
                },
                768: {
                    slidesPerView: 3,
                },
                992: {
                    slidesPerView: 4,
                },
                1200: {
                    spaceBetween: 20,
                    slidesPerView: 4,
                },
                1680: {
                    spaceBetween: 26,
                    slidesPerView: 4,
                },
                1700: {
                    spaceBetween: 30,
                    slidesPerView: 4.7,
                }
            }
        });
    }

    // reviews slider
    const ulReviewsSlider = document.querySelector(".ul-reviews-slider");
    if (ulReviewsSlider) {
        const slideCount = ulReviewsSlider.querySelectorAll(".swiper-slide").length;
        new Swiper(".ul-reviews-slider", {
            slidesPerView: 1,
            loop: slideCount >= 8, // Max views is 4, so 8 is safe
            autoplay: true,
            spaceBetween: 15,
            breakpoints: {
                768: {
                    slidesPerView: 2,
                },
                992: {
                    spaceBetween: 20,
                    slidesPerView: 3,
                },
                1200: {
                    spaceBetween: 20,
                    slidesPerView: 4,
                },
                1680: {
                    slidesPerView: 4,
                    spaceBetween: 26,
                },
                1700: {
                    slidesPerView: 4,
                    spaceBetween: 30,
                }
            }
        });
    }

    // gallery slider
    const ulGallerySlider = document.querySelector(".ul-gallery-slider");
    if (ulGallerySlider) {
        const slideCount = ulGallerySlider.querySelectorAll(".swiper-slide").length;
        new Swiper(".ul-gallery-slider", {
            slidesPerView: 2.2,
            loop: slideCount >= 12, // Max slidesPerView is 6, so 12 is needed for stable loop
            autoplay: true,
            centeredSlides: true,
            spaceBetween: 15,
            breakpoints: {
                480: {
                    slidesPerView: 3.4,
                },
                576: {
                    slidesPerView: 4,
                },
                768: {
                    slidesPerView: 5,
                },
                992: {
                    spaceBetween: 20,
                    slidesPerView: 5.5,
                },
                1680: {
                    spaceBetween: 26,
                    slidesPerView: 5.5,
                },
                1700: {
                    spaceBetween: 30,
                    slidesPerView: 5.5,
                },
                1920: {
                    spaceBetween: 30,
                    slidesPerView: 6,
                    centeredSlides: false,
                }
            }
        });
    }

    // product page price filter
    var priceFilterSlider = document.getElementById('ul-products-price-filter-slider');

    if (priceFilterSlider) {
        noUiSlider.create(priceFilterSlider, {
            start: [20, 80],
            connect: true,
            range: {
                'min': 0,
                'max': 100
            }
        });
    }

    // product details slider
    const ulProductDetailsImgSlider = document.querySelector(".ul-product-details-img-slider");
    if (ulProductDetailsImgSlider) {
        const slideCount = ulProductDetailsImgSlider.querySelectorAll(".swiper-slide").length;
        new Swiper(".ul-product-details-img-slider", {
            slidesPerView: 1,
            loop: slideCount > 1,
            autoplay: true,
            spaceBetween: 0,
            navigation: {
                nextEl: "#ul-product-details-img-slider-nav .next",
                prevEl: "#ul-product-details-img-slider-nav .prev",
            },
        });
    }

    // search category
    if (document.querySelector("#ul-checkout-country")) {
        new SlimSelect({
            select: '#ul-checkout-country',
            settings: {
                showSearch: false,
                contentLocation: document.querySelector('.ul-checkout-country-wrapper')
            }
        })
    }


    // quantity field
    if (document.querySelector(".ul-product-quantity-wrapper")) {
        const quantityWrapper = document.querySelectorAll(".ul-product-quantity-wrapper");

        quantityWrapper.forEach((item) => {
            const quantityInput = item.querySelector(".ul-product-quantity");
            const quantityIncreaseButton = item.querySelector(".quantityIncreaseButton");
            const quantityDecreaseButton = item.querySelector(".quantityDecreaseButton");

            quantityIncreaseButton.addEventListener("click", function () {
                quantityInput.value = parseInt(quantityInput.value) + 1;
            });
            quantityDecreaseButton.addEventListener("click", function () {
                if (quantityInput.value > 1) {
                    quantityInput.value = parseInt(quantityInput.value) - 1;
                }
            });
        })
    }

    // parallax effect
    const parallaxImage = document.querySelector(".ul-video-cover");

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                window.addEventListener("scroll", parallaxEffect);
                parallaxEffect(); // Initialize position
            } else {
                window.removeEventListener("scroll", parallaxEffect);
            }
        });
    });

    if (parallaxImage) {
        observer.observe(parallaxImage);
    }

    function parallaxEffect() {
        const rect = parallaxImage.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const imageCenter = rect.top + rect.height / 2;
        const viewportCenter = windowHeight / 2;

        // Calculate offset from viewport center
        const offset = (imageCenter - viewportCenter) * -0.5; // Adjust speed with multiplier

        parallaxImage.style.transform = `translateY(${offset}px)`;
    }

    // PRODUCT BOX CLICK NAVIGATION
    document.addEventListener('click', (e) => {
        // Find the closest product box
        const productBox = e.target.closest('.ul-product, .ul-product-horizontal');
        if (!productBox) return;

        // Ignore if the click was on a button, an action icon, or a direct link (like category)
        const ignoredElements = 'button, i, a, .ul-product-actions, .ul-product-category';
        if (e.target.closest(ignoredElements)) return;

        // Find the primary link (usually the product name link)
        const primaryLink = productBox.querySelector('.ul-product-title a');
        if (primaryLink && primaryLink.href) {
            window.location.href = primaryLink.href;
        }
    });

});
