const HuddlyDeviceAPIUSB = require('@huddly/device-api-usb').default;
const HuddlySdk = require('@huddly/sdk').default;
const notifier = require('node-notifier');

const usbApi = new HuddlyDeviceAPIUSB();
const sdk = new HuddlySdk(usbApi, [usbApi]);

const init = async () => {
	await sdk.init();

	sdk.on('ATTACH', async (cam) => {
		let standardPos = { x: 0, y: 0, width: 0, height: 0 };
		const detector = await cam.getDetector();
		await detector.init();

		let trainingPeriod = 1;
		let tolerance = 0.1;
		process.argv.forEach(arg => {
			let parsed = parseFloat(arg);
			if (!isNaN(parsed)) tolerance = parsed;
		});

		detector.on('DETECTIONS', (detections) => {
			if (!detections.some(obj => obj.label === 'head')) {
				return;
			}

			const headPos = detections.find((d) => d.label === 'head').bbox;

			if (trainingPeriod < 10) {
				// Set base
				if (trainingPeriod == 0) {
					standardPos = headPos;
				}

				// Increment the standardPos with the current pos
				Object.entries(headPos).forEach(([key, val]) => {
					standardPos[key] += val;
				});

				trainingPeriod++;

				// Calculate average
				if (trainingPeriod == 10) {
					Object.entries(standardPos).forEach(([key, val]) => {
						standardPos[key] = val / trainingPeriod;
					});
				}
			} else {
				// Is user out of position on any of the data points?
				Object.entries(headPos).forEach(([key, val]) => {
					if (Math.abs(standardPos[key] - val) > tolerance) {
						console.error('Straighten up!');
						notifier.notify('Straighten up!');
					}
				});
			}
		});

		// Exit handler
		process.on('SIGINT', async () => {
			await detector.destroy();
			await cam.closeConnection();
			process.exit();
		});
	});
}

init();
