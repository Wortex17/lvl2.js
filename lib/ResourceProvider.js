var _ = require("lodash");
var multimatch = require("multimatch");
var path = require("path");

/**
 * A ResourceProvider Ruleset, with various trigger paths stored as keys, and actions and/or configs as values
 *
 * Each key is a string, which defines one or multiple glob patterns as triggers.
 * Multiple glob patterns are separated by " | " (space, pipe, space)
 *
 * Rules are inheriting by registration order.
 * The lowest/youngest applying rule in the ruleset overrides all previously applying rule configurations.
 *
 * @typedef {Object<string, ResourceProvider~Rule|function|string|boolean>} ResourceProvider~Ruleset
 * If rule is a function it is a DYNAMIC_HANDLER
 * If rule is a string it is a STATIC_REROUTE
 * If (rule===true) it is a STATIC_UNLOCK
 * If (rule===false) it is a STATIC_LOCK
 *
 */

/**
 * A ResourceProvider Rule which may contain a single action and/or multiple other options
 * Depending on the type of 'action', a different action is assumed:
 * If action is a function it is a DYNAMIC_HANDLER
 * If action is a string it is a STATIC_REROUTE
 * If (action===true) it is a STATIC_UNLOCK
 * If (action===false) it is a STATIC_LOCK
 *
 * A DYNAMIC_HANDLER calls the given handler function for the resource request.
 * A STATIC_REROUTE resets the request for the resource and restarts it with given rerouted path
 * A STATIC_UNLOCK releases any inherited STATIC_LOCKs
 * A STATIC_LOCK sets a lock, denying all access to the matched resources.
 *
 * @typedef {Object} ResourceProvider~Rule
 * @property {function|string|boolean} [action] - Defines the resource action.
 * @property {boolean} [fallbackIndex] - Indicates if the index file index.html, index.htm, index.js, index.json) should be loaded when accessing a directory.
 * @property {string[]} [$p] - The paths/patterns that trigger this rule - this will be set by the ResourceProvider
 * @property {string[]} [$ps] - Array of rule triggers/patterns that have been matched/applied. Filled by ResourceProvider#getRulesFor
 */

/**
 * A ResourceProvider is instanced a single time for each installed lvl2app.
 * The lvl2app can define multiple mapping rules for how it's resources are provided.
 * This is defined through its config (or runtime changes)
 * @param {string} appId
 * @param {Object} [config]
 * @param {ResourceProvider~Ruleset} [config.rules]
 * @constructor
 */
function ResourceProvider(appId, config)
{
    if(!_.isString(appId))
    {
        throw new TypeError("appId is no string");
    }

    config = _.extend({map: {}, rules: {}}, config);
    this.appId = appId;

    /**
     * @type {{string: ResourceProvider~Rule}}
     * @private
     */
    this._rules = {};
    this._useRules(config.rules);

}
/**
 * *? is therefore reserved as segment beginning
 * @type {string}
 * @const
 */
ResourceProvider.MAP_CONFIG_WORD = '*?';
/**
 * @readonly
 * @type {number}
 */
ResourceProvider.prototype.dynamicHandlerCount = 0;
/**
 * @readonly
 * @type {number}
 */
ResourceProvider.prototype.staticRerouteCount = 0;
/**
 * @readonly
 * @type {number}
 */
ResourceProvider.prototype.staticLockCount = 0;

/**
 * Handles the given path to a resource under the lvl2-resource protocol
 * Looks if there are any path handlers, reroutes or blocks.
 * @param {string} resourcePath - the resolved recourse path, relaive to the lvl2app root, without the appId/basename.
 * @return {null} - returns either a function (custom handler), a string (resolved path) or false (blocked)
 */
ResourceProvider.prototype.handleResourcePath = function(resourcePath)
{
    if(!_.isString(resourcePath))
    {
        throw new TypeError("resourcePath is no string");
    }

    return null;
};

/**
 * Integrates the given Ruleset into the ResourceProvider
 * @param {ResourceProvider~Ruleset} ruleset
 * @private
 */
ResourceProvider.prototype._useRules = function(ruleset)
{
    if(!ruleset)
        return;

    if(!_.isPlainObject(ruleset))
    {
        throw new TypeError("ruleset is no plain Object");
    }
    var that = this;
    _.forOwn(ruleset, function(rule, pattern){
        that._useRule(pattern, rule);
    });
};

/**
 *
 * @param {string} globs
 * @param {ResourceProvider~Rule|function|string|boolean} rule
 * @private
 */
ResourceProvider.prototype._useRule = function(globs, rule)
{
    if(!_.isString(globs))
    {
        throw new TypeError("globs is no string");
    }

    if(_.isFunction(rule) || _.isString(rule) || _.isBoolean(rule))
    {
        rule = {action: rule};

    } else if(_.isPlainObject(rule) &&
        (_.isUndefined(rule.action) || _.isFunction(rule.action) || _.isString(rule.action) || _.isBoolean(rule.action)))
    {
        //rule = rule;
    } else
    {
        throw new TypeError("rule is no supported Rule type/config");
    }
    rule['$p'] = parseGlobMultiPattern(globs);
    globs = stringifyGlobMultiPattern(rule['$p']);

    if(_.isFunction(rule.action))
    {
        this.dynamicHandlerCount++;

    } else if(_.isString(rule.action))
    {
        this.staticRerouteCount++;

    } else if(rule.action === false)
    {
        this.staticLockCount++;
    }

    this._rules[globs] = rule;

    return globs;

};

ResourceProvider.prototype._normalizeResourcePath = function(resourcePath)
{
    if(!_.isString(resourcePath))
    {
        throw new TypeError("resourcePath is no string");
    }

    //Normalize the path
    /**
    var resourcePathSegments = path.normalize(resourcePath).split(path.sep);
    if(resourcePathSegments.length > 0 && !!resourcePathSegments[0])
        resourcePathSegments.unshift(''); //Add a empty element at front for front slashes
    return resourcePathSegments.join(path.sep);
     **/
    return path.normalize(resourcePath);
};

/**
 * Collects all inherited rules, top down
 * @param {string} resourcePath
 */
ResourceProvider.prototype.getRulesFor = function(resourcePath)
{
    var appliedRules = [];
    /**
     * @type {ResourceProvider~Rule}
     */
    var combinedRules = {};
    resourcePath = this._normalizeResourcePath(resourcePath);
    _.forOwn(this._rules, function(rule, globs){
        var matchResult = multimatch(resourcePath, rule['$p']);
        if(matchResult.length > 0)
        {
            appliedRules.push(globs);
            combinedRules = _.extend(combinedRules, rule);
        }
    });
    delete combinedRules['$p'];
    combinedRules['$ps'] = appliedRules;
    combinedRules['$target'] = resourcePath;
    return combinedRules;
};

/**
 * Returns a specific rule set for a specific globs
 * (Corrects and normalizes the globs first)
 * @param globs
 * @return {ResourceProvider~Rule|undefined}
 */
ResourceProvider.prototype.getRule = function(globs)
{
    if(!_.isString(globs))
    {
        throw new TypeError("globs is no string");
    }
    globs = stringifyGlobMultiPattern(parseGlobMultiPattern(globs));
    return this._rules[globs];
};

function parseGlobMultiPattern(string)
{
    var patterns = [];
    var raw_patterns = string.split(" | ");
    _.forEach(raw_patterns, function(pattern){
        if(!!pattern)
        {
            patterns.push(pattern);
        }
    });
    return patterns;
}
function stringifyGlobMultiPattern(globs)
{
    return globs.join(" | ");
}

module.exports = ResourceProvider;