<?php
/*
Plugin Name: SunPlanner
Plugin URI: https://allemedia.pl/
Description: Planer plenerów (złota/niebieska godzina, trasy, pogoda, eksporty).
Version: 1.7.0
Author: Allemedia
Author URI: https://allemedia.pl/
License: GPLv2 or later
Text Domain: sunplanner
*/

if (!defined('SUNPLANNER_VERSION')) {
    define('SUNPLANNER_VERSION', '1.7.0');
}

if (!defined('SUNPLANNER_FILE')) {
    define('SUNPLANNER_FILE', __FILE__);
}

if (!defined('SUNPLANNER_PATH')) {
    define('SUNPLANNER_PATH', plugin_dir_path(__FILE__));
}

if (!defined('SUNPLANNER_URL')) {
    define('SUNPLANNER_URL', plugin_dir_url(__FILE__));
}

require_once SUNPLANNER_PATH . 'includes/class-sunplanner-plugin.php';

Allemedia\SunPlanner\Plugin::instance()->init();
