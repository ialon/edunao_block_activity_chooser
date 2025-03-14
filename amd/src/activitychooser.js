/**
 * A block used as for choosing modules in a course.
 *
 * @module     block_activity_chooser/activitychooser
 * @copyright  2025 Josemaria Bolanos <admin@mako.digital>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as Repository from 'core_course/local/activitychooser/repository';
import * as Templates from 'core/templates';
import Pending from 'core/pending';

// Set up some JS module wide constants that can be added to in the future.

// Tab config options.
const ALLACTIVITIESRESOURCES = 0;
const ACTIVITIESRESOURCES = 2;
const ALLACTIVITIESRESOURCESREC = 3;
const ONLYALLREC = 4;
const ACTIVITIESRESOURCESREC = 5;

// Module types.
const ACTIVITY = 0;
const RESOURCE = 1;

let initialized = false;

/**
 * Set up the activity chooser.
 *
 * @method init
 * @param {Number} courseId Course ID to use later on in fetchModules()
 * @param {Object} chooserConfig Any PHP config settings that we may need to reference
 */
export const init = async (courseId, chooserConfig) => {
    const pendingPromise = new Pending();

    // Ensure we only add our listeners once.
    if (initialized) {
        return;
    }

    const fetchModuleData = (() => {
        let innerPromise = null;

        return () => {
            if (!innerPromise) {
                innerPromise = new Promise((resolve) => {
                    resolve(Repository.activityModules(courseId));
                });
            }

            return innerPromise;
        };
    })();

    // Grab the first section that has a data-sectionid attribute.
    const caller = document.querySelector('.course-section[data-sectionid]');

    // We want to show the modal instantly but loading whilst waiting for our data.
    let bodyPromiseResolver;
    const bodyPromise = new Promise(resolve => {
        bodyPromiseResolver = resolve;
    });

    buildBlock(bodyPromise);

    // Now we have a modal we should start fetching data.
    // If an error occurs while fetching the data, display the error within the modal.
    const data = await fetchModuleData().catch(async(e) => {
        const errorTemplateData = {
            'errormessage': e.message
        };
        bodyPromiseResolver(await Templates.render('core_course/local/activitychooser/error', errorTemplateData));
    });

    // Early return if there is no module data.
    if (!data) {
        return;
    }

    // Apply the section id to all the module instance links.
    const builtModuleData = sectionIdMapper(data, caller.dataset.sectionid);

    bodyPromiseResolver(await Templates.render(
        'core_course/activitychooser',
        templateDataBuilder(builtModuleData, chooserConfig)
    ));

    initialized = true;

    pendingPromise.resolve();
};

/**
 * Given the web service data and an ID we want to make a deep copy
 * of the WS data then add on the section ID to the addoption URL
 *
 * @method sectionIdMapper
 * @param {Object} webServiceData Our original data from the Web service call
 * @param {Number} id The ID of the section we need to append to the links
 * @param {Number|null} sectionreturnid The ID of the section return we need to append to the links
 * @param {Number|null} beforemod The ID of the cm we need to append to the links
 * @return {Array} [modules] with URL's built
 */
const sectionIdMapper = (webServiceData, id, sectionreturnid, beforemod) => {
    // We need to take a fresh deep copy of the original data as an object is a reference type.
    const newData = JSON.parse(JSON.stringify(webServiceData));
    newData.content_items.forEach((module) => {
        module.link += '&section=' + id + '&sr=' + (sectionreturnid ?? 0) + '&beforemod=' + (beforemod ?? 0);
    });
    return newData.content_items;
};

/**
 * Given an array of modules we want to figure out where & how to place them into our template object
 *
 * @method templateDataBuilder
 * @param {Array} data our modules to manipulate into a Templatable object
 * @param {Object} chooserConfig Any PHP config settings that we may need to reference
 * @return {Object} Our built object ready to render out
 */
const templateDataBuilder = (data, chooserConfig) => {
    // Setup of various bits and pieces we need to mutate before throwing it to the wolves.
    let activities = [];
    let resources = [];
    let showAll = true;
    let showActivities = false;
    let showResources = false;

    // Tab mode can be the following [All, Resources & Activities, All & Activities & Resources].
    const tabMode = parseInt(chooserConfig.tabmode);

    // Filter the incoming data to find favourite & recommended modules.
    const favourites = data.filter(mod => mod.favourite === true);
    const recommended = data.filter(mod => mod.recommended === true);

    // Whether the activities and resources tabs should be displayed or not.
    const showActivitiesAndResources = (tabMode) => {
        const acceptableModes = [
            ALLACTIVITIESRESOURCES,
            ALLACTIVITIESRESOURCESREC,
            ACTIVITIESRESOURCES,
            ACTIVITIESRESOURCESREC,
        ];

        return acceptableModes.indexOf(tabMode) !== -1;
    };

    // These modes need Activity & Resource tabs.
    if (showActivitiesAndResources(tabMode)) {
        // Filter the incoming data to find activities then resources.
        activities = data.filter(mod => mod.archetype === ACTIVITY);
        resources = data.filter(mod => mod.archetype === RESOURCE);
        showActivities = true;
        showResources = true;

        // We want all of the previous information but no 'All' tab.
        if (tabMode === ACTIVITIESRESOURCES || tabMode === ACTIVITIESRESOURCESREC) {
            showAll = false;
        }
    }

    const recommendedBeforeTabs = [
        ALLACTIVITIESRESOURCESREC,
        ONLYALLREC,
        ACTIVITIESRESOURCESREC,
    ];
    // Whether the recommended tab should be displayed before the All/Activities/Resources tabs.
    const recommendedBeginning = recommendedBeforeTabs.indexOf(tabMode) !== -1;

    // Given the results of the above filters lets figure out what tab to set active.
    // We have some favourites.
    const favouritesFirst = !!favourites.length;
    const recommendedFirst = favouritesFirst === false && recommendedBeginning === true && !!recommended.length;
    // We are in tabMode 2 without any favourites.
    const activitiesFirst = showAll === false && favouritesFirst === false && recommendedFirst === false;
    // We have nothing fallback to show all modules.
    const fallback = showAll === true && favouritesFirst === false && recommendedFirst === false;

    return {
        'default': data,
        showAll: showAll,
        activities: activities,
        showActivities: showActivities,
        activitiesFirst: activitiesFirst,
        resources: resources,
        showResources: showResources,
        favourites: favourites,
        recommended: recommended,
        recommendedFirst: recommendedFirst,
        recommendedBeginning: recommendedBeginning,
        favouritesFirst: favouritesFirst,
        fallback: fallback,
    };
};

/**
 * Given an object we want to add the content to the block and display it.
 *
 * @method buildBlock
 * @param {Promise} bodyPromise
 * @return {Object} The modal ready to display immediately and render bodyPromise in later.
 */
const buildBlock = (bodyPromise) => {
    const pendingBlockPromise = new Pending();

    let block = document.querySelector('.block_activity_chooser');
    if (block) {
        // Now we can actually display the content.
        bodyPromise.then((html, js) => {
            let content = block.querySelector('#block-activity-chooser-content');
            content.innerHTML = html;

            let options = block.querySelectorAll('.optioninfo a[data-action]');
            options.forEach((option) => {
                option.setAttribute('draggable', 'true');

                option.addEventListener('drag', () => {
                    option.classList.add('dragging');
                });

                option.addEventListener('dragend', () => {
                    option.classList.remove('dragging');
                });
            });

            let activities = document.querySelectorAll('.course-content .activity');
            activities.forEach((activity) => {
                activity.addEventListener('dragover', (e) => {
                    let activeOption = block.querySelector('.optioninfo a.dragging');

                    if (activeOption) {
                        e.preventDefault();
                        activity.classList.add('dd-drop-down');
                    }
                });

                activity.addEventListener('dragleave', (e) => {
                    let activeOption = block.querySelector('.optioninfo a.dragging');

                    if (activeOption) {
                        e.preventDefault();
                        activity.classList.remove('dd-drop-down');
                    }
                });

                activity.addEventListener('drop', (e) => {
                    let activeOption = block.querySelector('.optioninfo a.dragging');

                    if (activeOption) {
                        e.preventDefault();

                        let sectionId = activity.closest('.course-section').dataset.sectionid;

                        let beforeMod = null;
                        let nextActivity = activity.nextElementSibling;
                        if (nextActivity) {
                            beforeMod = nextActivity.dataset.id;
                        }

                        let url = activeOption.getAttribute('href') + '&section=' + sectionId + '&beforemod=' + beforeMod;
                        window.location.href = url;
                    }
                });
            });

            if (js) {
                Templates.runTemplateJS(js);
            }
        });
    }

    pendingBlockPromise.resolve();
};
