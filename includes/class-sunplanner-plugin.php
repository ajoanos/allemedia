<?php

namespace Allemedia\SunPlanner;

use Allemedia\SunPlanner\Rest\Share_Controller;
use Allemedia\SunPlanner\Rest\Contact_Controller;
use Allemedia\SunPlanner\Rest\Radar_Controller;

require_once __DIR__ . '/class-sunplanner-rewrites.php';
require_once __DIR__ . '/class-sunplanner-frontend.php';
require_once __DIR__ . '/rest/class-share-controller.php';
require_once __DIR__ . '/rest/class-contact-controller.php';
require_once __DIR__ . '/rest/class-radar-controller.php';

class Plugin
{
    /**
     * @var Plugin|null
     */
    private static $instance = null;

    /**
     * @var Rewrites
     */
    private $rewrites;

    /**
     * @var Frontend
     */
    private $frontend;

    /**
     * @var array<int, object>
     */
    private $rest_controllers = [];

    private function __construct()
    {
        $this->rewrites = new Rewrites();
        $this->frontend = new Frontend();

        $this->rest_controllers = [
            new Share_Controller(),
            new Contact_Controller(),
            new Radar_Controller(),
        ];
    }

    public static function instance(): Plugin
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    public function init(): void
    {
        $this->rewrites->register_hooks();
        $this->frontend->register_hooks();

        \add_action('rest_api_init', function () {
            foreach ($this->rest_controllers as $controller) {
                if (method_exists($controller, 'register_routes')) {
                    $controller->register_routes();
                }
            }
        });

        if (defined('SUNPLANNER_FILE')) {
            \register_activation_hook(SUNPLANNER_FILE, [Rewrites::class, 'flush_rewrite_rules']);
            \register_deactivation_hook(SUNPLANNER_FILE, [Rewrites::class, 'flush_rewrite_rules']);
        }
    }
}
