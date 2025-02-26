<?php

/**
 * Activity Chooser block
 *
 * @package    block_activity_chooser
 * @copyright  2025 Josemaria Bolanos <admin@mako.digital>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
*/

class block_activity_chooser extends block_base {

    function init() {
        $this->title = get_string('blocktitle','block_activity_chooser');
    }

    function applicable_formats() {
        return array(
            'course-view' => true,
            'site' => true,
            'mod' => false,
            'my' => false,
        );
    }

    /**
     * It can be configured.
     *
     * @return bool
     */
    public function has_config() {
        return false;
    }

    function specialization() {
        $this->title = !empty($this->config->title) ? $this->config->title : get_string('blocktitle', 'block_activity_chooser');
    }

    function instance_allow_multiple() {
        return false;
    }

    function get_content() {
        global $COURSE, $CFG;

        //note: do NOT include files at the top of this file
        require_once($CFG->libdir . '/filelib.php');

        if ($this->content !== NULL) {
            return $this->content;
        }

        $this->content = new stdClass();
        $this->content->footer = '';

        $text = '';

        if ($this->page->requires->should_create_one_time_item_now('block_activity_chooser')) {
            // Build an object of config settings that we can then hook into in the Activity Chooser.
            $chooserconfig = (object) [
                'tabmode' => get_config('core', 'activitychoosertabmode'),
            ];
            $this->page->requires->js_call_amd('block_activity_chooser/activitychooser', 'init', [$COURSE->id, $chooserconfig]);
            $text = html_writer::tag('div', '', ['id' => 'block-activity-chooser-content']);
        }

        $this->content->text = $text;

        return $this->content;
    }
}

