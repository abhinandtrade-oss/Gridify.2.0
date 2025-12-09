/*-----------------------------------------------------------------------------------
    Template Name: Ridda - Web Design & SEO HTML Template
    Template URI: https://webtend.net/demo/html/ravelo/
    Author: WebTend
    Author URI:  https://webtend.net/
    Version: 1.0

    Note: This is Main JS File.
-----------------------------------------------------------------------------------
	CSS INDEX
	===================
    ## Header Style
    ## Dropdown menu
    ## Submenu
    ## Video Popup
    ## Client Logo Carousel
    ## Testimonials Carousel
    ## Testimonials Two
    ## Testimonials Three
    ## Project Popup
    ## Widget Gallery
    ## Latest Work
    ## Quantity Number
    ## Fact Counter
    ## Circle Progress
    ## Hover Content
    ## Case Study
    ## FAQ Nav
    ## FAQ Nav Fixed
    ## Scroll to Top
    ## Nice Select
    ## AOS Animation
    ## Preloader
    
-----------------------------------------------------------------------------------*/

(function ($) {

    "use strict";

    $(document).ready(function () {

        // ## Header Style and Scroll to Top
        function headerStyle() {
            if ($('.main-header').length) {
                var windowpos = $(window).scrollTop();
                var siteHeader = $('.main-header');
                var scrollLink = $('.scroll-top');
                if (windowpos >= 250) {
                    siteHeader.addClass('fixed-header');
                    scrollLink.fadeIn(300);
                } else {
                    siteHeader.removeClass('fixed-header');
                    scrollLink.fadeOut(300);
                }
            }
        }
        headerStyle();
        
        
        // ## Dropdown menu
        var mobileWidth = 992;
        var navcollapse = $('.navigation li.dropdown');

        navcollapse.hover(function () {
            if ($(window).innerWidth() >= mobileWidth) {
                $(this).children('ul').stop(true, false, true).slideToggle(300);
                $(this).children('.megamenu').stop(true, false, true).slideToggle(300);
            }
        });
        
        // ## Submenu Dropdown Toggle
        if ($('.main-header .navigation li.dropdown ul').length) {
            $('.main-header .navigation li.dropdown').append('<div class="dropdown-btn"><span class="far fa-angle-down"></span></div>');

            //Dropdown Button
            $('.main-header .navigation li.dropdown .dropdown-btn').on('click', function () {
                $(this).prev('ul').slideToggle(500);
                $(this).prev('.megamenu').slideToggle(800);
            });
            
            //Disable dropdown parent link
            $('.navigation li.dropdown > a').on('click', function (e) {
                e.preventDefault();
            });
        }
        
        //Submenu Dropdown Toggle
        if ($('.main-header .main-menu').length) {
            $('.main-header .main-menu .navbar-toggle').click(function () {
                $(this).prev().prev().next().next().children('li.dropdown').hide();
            });
        }
        
  
        // ## Video Popup
        if ($('.video-play').length) {
            $('.video-play').magnificPopup({
                type: 'video',
            });
        }

        
        // ## Client Logo Carousel
        if ($('.client-logo-active').length) {
            $('.client-logo-active').slick({
                infinite: true,
                speed: 400,
                arrows: false,
                dots: false,
                focusOnSelect: true,
                autoplay: true,
                autoplaySpeed: 5000,
                slidesToShow: 6,
                slidesToScroll: 1,
                responsive: [
                    {
                        breakpoint: 1200,
                        settings: {
                            slidesToShow: 5,
                        }
                    },
                    {
                        breakpoint: 991,
                        settings: {
                            slidesToShow: 4,
                        }
                    },
                    {
                        breakpoint: 768,
                        settings: {
                            slidesToShow: 3,
                        }
                    },
                    {
                        breakpoint: 575,
                        settings: {
                            slidesToShow: 2,
                        }
                    },
                ]
            });
        }
        
 
        // ## Testimonials Carousel
        if ($('.testimonials-active').length) {
            $('.testimonials-active').slick({
                infinite: true,
                speed: 400,
                arrows: false,
                dots: true,
                focusOnSelect: true,
                autoplay: true,
                autoplaySpeed: 5000,
                slidesToShow: 2,
                slidesToScroll: 1,
                responsive: [
                    {
                        breakpoint: 767,
                        settings: {
                            slidesToShow: 1,
                        }
                    }
                ]
            });
        }
        
 
        // ## Testimonials Two Carousel
        if ($('.testimonials-two-active').length) {
            $('.testimonials-two-active').slick({
                infinite: true,
                speed: 400,
                arrows: false,
                dots: true,
                appendDots: '.testimonial-dots',
                focusOnSelect: true,
                autoplay: true,
                autoplaySpeed: 5000,
                slidesToShow: 1,
                slidesToScroll: 1,
            });
        }
        

 
        // ## Testimonials Three Carousel
        if ($('.testimonials-three-active').length) {
            $('.testimonials-three-active').slick({
                infinite: true,
                speed: 400,
                arrows: false,
                dots: true,
                focusOnSelect: true,
                autoplay: true,
                autoplaySpeed: 5000,
                slidesToShow: 1,
                slidesToScroll: 1,
            });
        }
        

        // ## Project Popup Gallery
        $('.project-item .image').magnificPopup({
            type: 'image',
        });
        
        
        // ## Widget Gallery
        $('.widget-gallery .gallery a').magnificPopup({
            type: 'image',
            gallery: {
                enabled: true,
            },
        });
        
        
        // ## Latest Work
        $('.latest-work-item').click(function(){
            $('.latest-work-item').removeClass('active');
            $(this).addClass('active');
            $('.normal-area').slideDown();
            $(this).find('.normal-area').slideUp();
            $('.active-area').slideUp();
            $(this).find('.active-area').slideDown();
        });
        
        
        // ## Quantity Number js
        $('.quantity-down').on('click', function(){
            var numProduct = Number($(this).next().val());
            if(numProduct > 1) $(this).next().val(numProduct - 1);
        });
        $('.quantity-up').on('click', function(){
            var numProduct = Number($(this).prev().val());
            $(this).prev().val(numProduct + 1);
        });
        
        
         /* ## Fact Counter + Text Count - Our Success */
        if ($('.counter-text-wrap').length) {
            $('.counter-text-wrap').appear(function () {
                
                var $t = $(this),
                    n = $t.find(".count-text").attr("data-stop"),
                    r = parseInt($t.find(".count-text").attr("data-speed"), 10);

                if (!$t.hasClass("counted")) {
                    $t.addClass("counted");
                    $({
                        countNum: $t.find(".count-text").text()
                    }).animate({
                        countNum: n
                    }, {
                        duration: r,
                        easing: "linear",
                        step: function () {
                            $t.find(".count-text").text(Math.floor(this.countNum));
                        },
                        complete: function () {
                            $t.find(".count-text").text(this.countNum);
                        }
                    });
                }

            }, {
                accY: 0
            });
        }
        
        
        
        /* ## Circle Progress */
		if ($.fn.circleProgress) {
			var progressOne = $('.circle-progress.one')
			if($.fn.circleProgress) {
			  progressOne.appear(function () {
				progressOne.circleProgress({
					value: 0.85,
					size: 100,
                    thickness: 7,
					fill: "#FFD043",
                    lineCap: 'round',
					emptyFill: "white",
                    startAngle: Math.PI / 4 * 2,
					animation : { duration: 2000},
				  }).on('circle-animation-progress', function(event, progress) {
					$(this).find('.counting').html(Math.round(93 * progress) + '<span>%</span>');
				  });
			  });
			};
		};
		if ($.fn.circleProgress) {
			var progressTwo = $('.circle-progress.two')
			if($.fn.circleProgress) {
			  progressTwo.appear(function () {
				progressTwo.circleProgress({
					value: 0.75,
					size: 100,
                    thickness: 7,
					fill: "#FFD043",
                    lineCap: 'round',
					emptyFill: "white",
                    startAngle: Math.PI / 4 * 2,
					animation : { duration: 2000},
				  }).on('circle-animation-progress', function(event, progress) {
					$(this).find('.counting').html(Math.round(82 * progress) + '<span>%</span>');
				  });
			  });
			};
		};
		if ($.fn.circleProgress) {
			var progressThree = $('.circle-progress.three')
			if($.fn.circleProgress) {
			  progressThree.appear(function () {
				progressThree.circleProgress({
					value: 0.80,
					size: 100,
                    thickness: 7,
					fill: "#FFD043",
                    lineCap: 'round',
					emptyFill: "white",
                    startAngle: Math.PI / 4 * 2,
					animation : { duration: 2000},
				  }).on('circle-animation-progress', function(event, progress) {
					$(this).find('.counting').html(Math.round(89 * progress) + '<span>%</span>');
				  });
			  });
			};
		};
        
        
        // ## Hover Content
        $('.hover-item').hover(
            function(){
                $(this).find('.hover-content').slideDown();
            }, function() {
                $(this).find('.hover-content').slideUp();
            }
        );
        
        
        // ## Case Study
        $('.case-study-item').hover(function(){
            $('.case-study-item').removeClass('active');
            $(this).addClass('active');
        });
        
        
        // ## FAQ Nav
        $('.faq-nav li a').on('click', function(){
            $('.faq-nav li a').removeClass('active');
            $(this).addClass('active');
        });
        
        
        // ## Scroll to Top
        if ($('.scroll-to-target').length) {
            $(".scroll-to-target").on('click', function () {
                var target = $(this).attr('data-target');
                // animate
                $('html, body').animate({
                    scrollTop: $(target).offset().top
                }, 1000);

            });
        }
        
        
        // ## Nice Select
        $('select').niceSelect();
        
        
        // ## AOS Animation
        AOS.init();
        
 
    });
    
    
    /* ==========================================================================
       When document is resize, do
    ========================================================================== */

    $(window).on('resize', function () {
        var mobileWidth = 992;
        var navcollapse = $('.navigation li.dropdown');
        navcollapse.children('ul').hide();
        navcollapse.children('.megamenu').hide();

    });


    /* ==========================================================================
       When document is scroll, do
    ========================================================================== */
    
    
    // ## FAQ Nav Fixed
    if ($('.faq-tab-wrap').length) {
        var faqOffset = $('.faq-tab-wrap').offset().top;
        var footerOffset = $('.for-sticky').offset().top;
    }
    

    $(window).on('scroll', function () {
        
        // ## FAQ Nav Fixed
        var sticky = $('.faq-tab-wrap'),
            scroll = $(window).scrollTop();

        if (scroll >= faqOffset) sticky.addClass('fixed');
        else sticky.removeClass('fixed');
        if (scroll >= footerOffset) sticky.removeClass('fixed');


        // Header Style and Scroll to Top
        function headerStyle() {
            if ($('.main-header').length) {
                var windowpos = $(window).scrollTop();
                var siteHeader = $('.main-header');
                var scrollLink = $('.scroll-top');
                if (windowpos >= 100) {
                    siteHeader.addClass('fixed-header');
                    scrollLink.fadeIn(300);
                } else {
                    siteHeader.removeClass('fixed-header');
                    scrollLink.fadeOut(300);
                }
            }
        }

        headerStyle();
        
    });

    /* ==========================================================================
       When document is loaded, do
    ========================================================================== */

    $(window).on('load', function () {
        
        
        // ## Latest Work
        $('.latest-work-item .active-area').hide();
        $('.latest-work-item.active .active-area').show();
        $('.latest-work-item .normal-area').show();
        $('.latest-work-item.active .normal-area').hide();
        
        // ## AOS Animation
        AOS.init();

        // ## Preloader
        function handlePreloader() {
            if ($('.preloader').length) {
                $('.preloader').delay(200).fadeOut(500);
            }
        }
        handlePreloader();
        
    });

})(window.jQuery);
