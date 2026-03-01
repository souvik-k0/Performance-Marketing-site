document.addEventListener("DOMContentLoaded", () => {

    // --- Navbar Scroll Effect ---
    const navbar = document.getElementById("navbar");
    window.addEventListener("scroll", () => {
        navbar.classList.toggle("scrolled", window.scrollY > 50);
    });

    // --- Mobile Menu Drawer ---
    const menuToggle = document.getElementById("menu-toggle");
    const mobileDrawer = document.getElementById("mobile-drawer");
    if (menuToggle && mobileDrawer) {
        menuToggle.addEventListener("click", () => {
            mobileDrawer.classList.toggle("open");
            const icon = menuToggle.querySelector("i");
            icon.className = mobileDrawer.classList.contains("open") ? "ph ph-x" : "ph ph-list";
        });
        // Close drawer on link click
        mobileDrawer.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                mobileDrawer.classList.remove("open");
                menuToggle.querySelector("i").className = "ph ph-list";
            });
        });
    }

    // --- Tab Switching (Fully wired) ---
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.dataset.tab;
            // Update buttons
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            // Update panes
            tabPanes.forEach(p => p.classList.remove("active"));
            const targetPane = document.getElementById("tab-" + tabId);
            if (targetPane) targetPane.classList.add("active");
            // Reset feature list active state
            const featureItems = targetPane ? targetPane.querySelectorAll(".feature-list li") : [];
            featureItems.forEach((item, i) => {
                item.classList.toggle("active", i === 0);
            });
        });
    });

    // --- Feature List Accordion (within each tab) ---
    document.addEventListener("click", (e) => {
        const li = e.target.closest(".feature-list li");
        if (!li) return;
        const siblings = li.closest("ul").querySelectorAll("li");
        siblings.forEach(s => s.classList.remove("active"));
        li.classList.add("active");
    });

    // --- Intersection Observer for Scroll Reveal ---
    const revealElements = document.querySelectorAll(".reveal");
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealElements.forEach(el => revealObserver.observe(el));

    // Immediate reveal for elements already visible
    setTimeout(() => {
        revealElements.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight) {
                el.classList.add("active");
            }
        });
    }, 100);

    // --- Animated Metric Counters ---
    const metricValues = document.querySelectorAll(".metric-value[data-target]");
    let countersStarted = false;

    function animateCounters() {
        if (countersStarted) return;
        countersStarted = true;

        metricValues.forEach(el => {
            const target = parseFloat(el.dataset.target);
            const prefix = el.dataset.prefix || "";
            const suffix = el.dataset.suffix || "";
            const isDecimal = target % 1 !== 0;
            const duration = 2000;
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = target * eased;

                if (isDecimal) {
                    el.textContent = prefix + current.toFixed(1) + suffix;
                } else {
                    el.textContent = prefix + Math.round(current) + suffix;
                }

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }
            requestAnimationFrame(update);
        });
    }

    // Trigger counters when metrics section is in view
    const metricsSection = document.querySelector(".metrics-section");
    if (metricsSection) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        counterObserver.observe(metricsSection);
    }

    // --- FAQ Accordion ---
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const question = item.querySelector(".faq-question");
        question.addEventListener("click", () => {
            const isOpen = item.classList.contains("open");
            // Close all others
            faqItems.forEach(i => i.classList.remove("open"));
            // Toggle current
            if (!isOpen) item.classList.add("open");
        });
    });

    // --- Sticky CTA Bar ---
    const stickyCta = document.getElementById("sticky-cta");
    const heroSection = document.querySelector(".hero");
    const footerSection = document.querySelector(".footer");

    if (stickyCta && heroSection) {
        window.addEventListener("scroll", () => {
            const heroBottom = heroSection.getBoundingClientRect().bottom;
            const footerTop = footerSection ? footerSection.getBoundingClientRect().top : Infinity;
            const windowHeight = window.innerHeight;

            if (heroBottom < 0 && footerTop > windowHeight) {
                stickyCta.classList.add("visible");
            } else {
                stickyCta.classList.remove("visible");
            }
        });
    }

    // --- Form Submission (POST to /api/demos) ---
    const form = document.querySelector("#demo-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const originalText = btn.innerText;
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Submitting...';
            btn.disabled = true;

            const data = {
                name: form.querySelector('[name="name"]').value,
                email: form.querySelector('[name="email"]').value,
                company: form.querySelector('[name="company"]').value,
                adSpend: form.querySelector('[name="adSpend"]').value
            };

            try {
                const res = await fetch('/api/demos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Submission failed');

                btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Demo Booked!';
                btn.style.background = "#16a34a";
                form.reset();
                const successMsg = document.getElementById('demo-success');
                if (successMsg) successMsg.style.display = 'block';

                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = "";
                    btn.disabled = false;
                    if (successMsg) successMsg.style.display = 'none';
                }, 4000);
            } catch (err) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                alert('Something went wrong. Please try again.');
            }
        });
    }
});
