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
<main id="primary" class="sunplanner-share" style="min-height:60vh;">
    <div class="sunplanner-share__inner" style="margin:0 auto;max-width:1200px;padding:2rem 1rem;">
        <?php echo do_shortcode('[sunplanner]'); ?>
    </div>
</main>
<?php
get_footer();
