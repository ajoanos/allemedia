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
            <span class="sunplanner-share__badge">SunPlanner – planer plenerów ślubnych</span>
            <h1 class="sunplanner-share__title">Plan pleneru ślubnego przygotowany dla Waszej ekipy</h1>
            <p class="sunplanner-share__desc">Znajdziesz tu harmonogram światła, pogodę, trasę i notatki zebrane w SunPlannerze. Korzystaj na dowolnym urządzeniu i miej pewność, że wszyscy widzą te same aktualne dane.</p>
        </header>

        <?php echo do_shortcode('[sunplanner]'); ?>
    </div>
</main>
<?php
get_footer();
