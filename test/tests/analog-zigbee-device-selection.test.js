/* global describe, it */

describe('ZigBee device selection helpers', function () {
	it('normalizes IEEE addresses for stable device selection', function () {
		assert.strictEqual(OSApp.Analog.normalizeZigbeeDeviceSelectionKey('0x00124b002aa11bb2'), '00124B002AA11BB2');
		assert.strictEqual(OSApp.Analog.normalizeZigbeeDeviceSelectionKey('00124b002aa11bb2'), '00124B002AA11BB2');
		assert.strictEqual(OSApp.Analog.normalizeZigbeeDeviceSelectionKey('0x00124b002aa11bb2 '), '00124B002AA11BB2');
	});

	it('finds the matching device by a stable selection key instead of array index', function () {
		var devices = [
			{ ieee: '0x00124b002aa11bb2', model: 'GX03' },
			{ ieee: '0x00124b002cc22dd3', model: 'GX04' }
		];

		var selected = OSApp.Analog.findZigbeeDeviceBySelectionKey(devices, '0x00124b002cc22dd3');
		assert.ok(selected);
		assert.strictEqual(selected.model, 'GX04');
	});
});
