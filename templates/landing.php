<?php
/**
 * Landing page template rendered for the automatically created SunPlanner page.
 *
 * @package SunPlanner
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title><?php echo esc_html__('SunPlanner – zaplanuj plener ślubny', 'sunplanner'); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class('sunplanner-landing'); ?>>
<?php wp_body_open(); ?>
    <div class="page-shell">
        <section class="hero">
            <div>
                <span class="hero__badge">Dla Młodych Par i ekip foto-video</span>
                <h1 class="hero__title">Wasz plener ślubny, zaplanowany co do promyka słońca</h1>
                <p class="hero__subtitle">SunPlanner pomaga zsynchronizować pogodę, światło i logistykę tak, by dzień pleneru był czystą przyjemnością – bez gonitwy, bez zgadywania.</p>
                <a class="hero__cta" href="#jak-to-dziala">Zobacz jak działa SunPlanner →</a>
            </div>
            <div class="hero__media">
                <div class="hero__card">
                    <h3>Wasz dzień w skrócie</h3>
                    <strong>Plener 17:45</strong>
                    <div>
                        <p><strong>Złota godzina:</strong> 18:12 – 18:54</p>
                        <p><strong>Prognoza:</strong> Słonecznie, 22°C, wiatr 8 km/h</p>
                        <p><strong>Trasa:</strong> 42 min z Pałacu Czosnów do Kampinosu</p>
                    </div>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--muted);">Plan udostępniony ekipie foto-video i kierowcy jednym kliknięciem.</p>
                </div>
            </div>
        </section>

        <section class="split-section" id="dlaczego">
            <div class="split-section__grid">
                <header>
                    <span class="eyebrow">Dlaczego pary kochają SunPlanner</span>
                    <h2>Wszystko, czego potrzebujecie, by spokojnie wejść w plener</h2>
                    <p>SunPlanner składa plan Waszej sesji w jedno piękne, interaktywne miejsce. Od wyszukania inspiracji po logistykę i pogodę – bez Exceli, bez chaosu w wiadomościach.</p>
                </header>
                <div class="feature-list">
                    <article class="feature">
                        <div class="feature__icon">🗺️</div>
                        <h3>Trasa gotowa w kilka kliknięć</h3>
                        <p>Dodajcie start, przystanki i finał. SunPlanner wylicza czas dojazdu, sugeruje alternatywy i sprawdza, czy nie złapie Was korek.</p>
                    </article>
                    <article class="feature">
                        <div class="feature__icon">🕑</div>
                        <h3>Plan dnia w jednym widoku</h3>
                        <p>Od przygotowań po zachód słońca – cały harmonogram macie pod ręką z godzinami, dystansem i priorytetami.</p>
                    </article>
                    <article class="feature">
                        <div class="feature__icon">🌤️</div>
                        <h3>Pewność pogody i światła</h3>
                        <p>Prognoza 16-dniowa, radar opadów i wykresy nasłonecznienia pomagają trafić w idealne okno pogodowe.</p>
                    </article>
                    <article class="feature">
                        <div class="feature__icon">🤝</div>
                        <h3>Ekipa zawsze w synchro</h3>
                        <p>Fotograf, filmowiec i Para widzą te same notatki, terminy i checklistę. Powiadomienia idą tylko do właściwych osób.</p>
                    </article>
                    <article class="feature">
                        <div class="feature__icon">✨</div>
                        <h3>Inspiracje na miejscu</h3>
                        <p>Galeria moodboardów i zasady lokalizacji podpowiadają, jak wykorzystać przestrzeń, a nawet czy możecie użyć drona.</p>
                    </article>
                    <article class="feature">
                        <div class="feature__icon">🔗</div>
                        <h3>Udostępniacie tak, jak lubicie</h3>
                        <p>Link, PDF, karta klienta albo eksport do kalendarza – plan podróżuje wraz z Wami i Waszą ekipą.</p>
                    </article>
                </div>
            </div>
        </section>

        <section class="how-it-works" id="jak-to-dziala">
            <header style="margin-bottom: clamp(2rem, 5vw, 3rem); text-align: center;">
                <span class="eyebrow">Jak to działa?</span>
                <h2 style="margin: 1rem 0 0;">Zaplanujcie swój wymarzony plener w trzech prostych krokach</h2>
            </header>
            <div class="steps">
                <article class="step">
                    <h3>Wybierzcie miejsce i termin</h3>
                    <p>Wpiszcie lokalizację, a SunPlanner pokaże czas dojazdu, złotą i niebieską godzinę oraz najlepsze okienko pogodowe.</p>
                </article>
                <article class="step">
                    <h3>Zaprosicie ekipę</h3>
                    <p>Udostępnijcie plan fotografowi i filmowcowi. Wspólna tablica terminów i notatki trzymają wszystkich w tym samym rytmie.</p>
                </article>
                <article class="step">
                    <h3>Wyślijcie plan jednym kliknięciem</h3>
                    <p>Link lub PDF? Wybieracie sami, a SunPlanner pilnuje aktualizacji i przypomina o nadchodzących godzinach.</p>
                </article>
            </div>
        </section>

        <section class="split-section" id="inspiracje">
            <header style="text-align: center; margin-bottom: clamp(2rem, 6vw, 3rem);">
                <span class="eyebrow">Inspiracje</span>
                <h2>Scenariusze plenerów dopasowane do Waszej historii</h2>
                <p>W moodboardach SunPlanner czekają gotowe pomysły na plenery – od leśnej romantyczności, po modern chic w loftach. Zapiszcie ulubione i zabierzcie ze sobą.</p>
            </header>
            <div class="inspiration">
                <article class="inspiration__card" style="background: url('https://images.unsplash.com/photo-1520854221050-0f4caff449fb?auto=format&amp;fit=crop&amp;w=800&amp;q=80') center/cover;">
                    <div class="inspiration__content">
                        <h3>Złoty las</h3>
                        <p>Łagodne światło zachodu, dużo przestrzeni i miękkie pastelowe stylizacje.</p>
                    </div>
                </article>
                <article class="inspiration__card" style="background: url('https://images.unsplash.com/photo-1520854221050-0e9651c2a8d0?auto=format&amp;fit=crop&amp;w=800&amp;q=80') center/cover;">
                    <div class="inspiration__content">
                        <h3>Miejska noc</h3>
                        <p>Światła miasta, parasol z lampkami i elegancja jak z magazynu.</p>
                    </div>
                </article>
                <article class="inspiration__card" style="background: url('https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&amp;fit=crop&amp;w=800&amp;q=80') center/cover;">
                    <div class="inspiration__content">
                        <h3>Nadmorska bryza</h3>
                        <p>Poranne mgły, wiatr we włosach i ciepłe pledy na plaży.</p>
                    </div>
                </article>
            </div>
        </section>
    </div>
    <footer>
        <div class="page-shell footer-shell">
            <span>SunPlanner – planer plenerów ślubnych dla Par, fotografów i filmowców.</span>
            <span>Made with ♥ w Polsce.</span>
        </div>
    </footer>
<?php wp_footer(); ?>
</body>
</html>
