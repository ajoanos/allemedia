<?php
/**
 * Template for displaying SunPlanner shared plans.
 *
 * @package SunPlanner
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
?>

<main id="primary" class="sunplanner-share">
    <div class="sunplanner-share__inner">
        <header class="sunplanner-share__header">
            <span class="sunplanner-share__badge">SunPlanner</span>
            <h1 class="sunplanner-share__title">Udostępniony plan zdjęciowy</h1>
            <p class="sunplanner-share__desc">Poniżej znajdziesz zapisany plan dnia wraz z mapą, pogodą i kluczowymi godzinami przygotowany w aplikacji SunPlanner.</p>
        </header>

        <?php echo do_shortcode('[sunplanner]'); ?>
    </div>
</main>
<?php
get_footer();
