var expect = require("chai").expect;
var testHelpers = require("./_testHelpers");

describe("ResourceProvider", function() {

    var ResourceProvider = require("../../lib/ResourceProvider.js");

    describe("instantiation", function() {

        it("fails with TypeError without appId", function () {
            expect(function(){
                new ResourceProvider();
            }).to.throw(TypeError);
        });

        it("fails with TypeError with non-string appId", function () {
            expect(function(){
                new ResourceProvider(42);
            }).to.throw(TypeError);
        });

        it("succeeds with appId and without config", function () {
            expect(function(){
                new ResourceProvider(testHelpers.appId);
            }).to.not.throw(TypeError);
        });

        it("succeeds with appId and with config", function () {
            expect(function(){
                new ResourceProvider(testHelpers.appId, {foo:'bar'});
            }).to.not.throw(TypeError);
        });


    });

    describe("Instance w/o config", function() {

        var resProv = new ResourceProvider(testHelpers.appId);

        it("stores the appId it was created with", function () {
            expect(resProv.appId).to.be.equal(testHelpers.appId);
        });
        it("has 0 rules", function () {
            expect(Object.keys(resProv._rules).length).to.be.equal(0);
        });
        it("has 0 dynamic handlers", function () {
            expect(resProv.dynamicHandlerCount).to.be.equal(0);
        });
        it("has 0 static reroutes", function () {
            expect(resProv.staticRerouteCount).to.be.equal(0);
        });
        it("has 0 static locks", function () {
            expect(resProv.staticLockCount).to.be.equal(0);
        });
    });

    describe("Instance w/ initial config only", function() {
        var config = {
            rules: {
                "dynamicDir/": function () {
                },
                "a/": "b/",
                "lockedDir/": false
            }
        };

        var resProv = new ResourceProvider(testHelpers.appId, config);

        it("stores the appId it was created with", function () {
            expect(resProv.appId).to.be.equal(testHelpers.appId);
        });
        it("has > 0 rules", function () {
            expect(Object.keys(resProv._rules).length).to.be.greaterThan(0);
        });
        it("has > 0 dynamic handlers", function () {
            expect(resProv.dynamicHandlerCount).to.be.greaterThan(0);
        });
        it("has > 0 static reroutes", function () {
            expect(resProv.staticRerouteCount).to.be.greaterThan(0);
        });
        it("has > 0 static locks", function () {
            expect(resProv.staticLockCount).to.be.greaterThan(0);
        });
    });

    describe("Instance w/ specific initial config", function() {

        var rules = {};
        rules["dynamicDir/"] = function () {};
        rules["lockedDir/"] = false;
        rules["unlockedDir/"] = true;
        rules["redirect_from/"] = "redirect_to/";
        rules[
        "locked\n" +
        "lockedB"
            ] = false;
        rules["locked/unlocked"] = true;

        var config = {
            rules: rules
        };

        var resProv = new ResourceProvider(testHelpers.appId, config);

        describe("Local Rule registration", function() {

            it("has registered a lock for the lockedDir", function () {
                var rule = resProv.getRule("lockedDir/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal(false);
            });
            it("has registered a lock for the unlockedDir", function () {
                var rule = resProv.getRule("unlockedDir/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal(true);
            });
            it("has registered a handler for the dynamicDir", function () {
                var rule = resProv.getRule("dynamicDir/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.a('function');
            });
            it("has registered a reroute target for the redirect_from to redirect_to", function () {
                var rule = resProv.getRule("redirect_from/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal('redirect_to/');
            });

        });

        describe("Rules for locked | lockedB", function() {

            it("shows locked as locked", function () {
                var rule = resProv.getRulesFor("locked/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal(false);
            });
            it("shows lockedB as locked", function () {
                var rule = resProv.getRulesFor("lockedB/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal(false);
            });
        });
        describe("Rules for locked/unlocked", function() {

            it("shows locked as locked", function () {
                var rule = resProv.getRulesFor("locked/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal(false);
            });
            it("shows locked/unlocked as unlocked", function () {
                var rule = resProv.getRulesFor("locked/unlocked/");
                if(rule === null)
                    expect(rule).to.be.not.equal(null);
                else if(rule === undefined)
                    expect(rule).to.be.not.equal(undefined);
                else
                    expect(rule.action).to.be.equal(true);
            });
        });

    });
});
