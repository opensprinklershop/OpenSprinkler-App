/* eslint-disable */

describe("Corrupted JSON Checks", function() {
	it("repairs malformed /jc MQTT separators before parsing controller settings", function() {
		var payload = '{"devt":1775996423,"lrun":[0,0,0,0],"loc":"49.23904,8.55839","mqtt":{"en":1,"host":"192.168.0.50","port":1883,"user":"opensprinkler"2C"pass":"opensprinkler","pubt":"OSPi","subt":"OS-B827EB8D82EC"},"ps":[[0,0,0,0]],"wto":{},"ifkey":"","dname":"OSPI"}',
			result = OSApp.Sites.parseControllerSettings( payload );

		assert.isOk( result );
		assert.equal( result.settings.mqtt.user, "opensprinkler" );
		assert.equal( result.settings.mqtt.pass, "opensprinkler" );
		assert.equal( result.settings.dname, "OSPI" );
	} );
} );
