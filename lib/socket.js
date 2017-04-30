var module_name = __filename.slice(__dirname.length + 1, -3);

module.exports = {
	io : null,

	// Check before sending data
	check : (check_callback) => {
		// Check config
		if (typeof config             === 'undefined' || config             === null) { return; };
		if (typeof config.server      === 'undefined' || config.server      === null) { return; };
		if (typeof config.server.host === 'undefined' || config.server.host === null) { return; };
		if (typeof config.server.port === 'undefined' || config.server.port === null) { return; };

		// Check status
		if (typeof status                  === 'undefined' || status                  === null) { return; };
		if (typeof status.server           === 'undefined' || status.server           === null) { return; };
		if (typeof status.server.connected === 'undefined' || status.server.connected === null) { return; };

		// Check socket
		if (typeof socket         === 'undefined' || socket         === null) { return; };
		if (typeof socket.io      === 'undefined' || socket.io      === null) { return; };
		if (typeof socket.io.emit === 'undefined' || socket.io.emit === null) { return; };

		check_callback();
	},

	startup : (startup_callback) => {
		socket.check(() => {
			if (status.server.connected === true) {
				log.msg({
					src : module_name,
					msg : 'bus-client already connected',
				});
				return;
			}
		});

		var socket_options = {
			autoConnect          : false,
			path                 : '/socket.io',
			randomizationFactor  : 0.5,
			reconnection         : true,
			reconnectionAttempts : Infinity,
			reconnectionDelay    : 1000,
			reconnectionDelayMax : 5000,
			timeout              : 20000,
		};

		log.msg({
			src : module_name,
			msg : 'server: \''+config.server.host+'\', port: '+config.server.port,
		});

		var server_url = 'http://'+config.server.host+':'+config.server.port;

		socket.io = require('socket.io-client')(server_url, socket_options);

		socket.io.on('connect', () => {
			log.msg({
				src : module_name,
				msg : 'connected to server',
			});

			// Refresh all data on first connect
			if (status.server.reconnecting !== true) {
				IKE.obc_refresh();
			}

			status.server.connected    = true;
			status.server.connecting   = false;
			status.server.reconnecting = false;

			startup_callback();
		});

		socket.io.on('connect_error', (error) => {
			status.server.connected = false;

			log.msg({
				src : module_name,
				msg : 'connect error: '+error.description,
			});
		});

		socket.io.on('connect_timeout', () => {
			status.server.connected = false;
			log.msg({
				src : module_name,
				msg : 'connect timeout',
			});
		});

		socket.io.on('reconnect', (number) => {
			status.server.connected    = true;
			status.server.connecting   = false;

			// Request ignition on reconnect
			IKE.request('ignition');

			log.msg({
				src : module_name,
				msg : 'reconnected after '+number+' tries',
			});
		});

		socket.io.on('reconnect_attempt', () => {
			status.server.connected    = false;
			status.server.connecting   = true;
			status.server.reconnecting = true;

			// log.msg({
			//   src : module_name,
			//   msg : 'attempting to reconnect',
			// });
		});

		socket.io.on('reconnecting', (number) => {
			status.server.connected    = false;
			status.server.connecting   = true;
			status.server.reconnecting = true;

			log.msg({
				src : module_name,
				msg : 'attempting to reconnect, try #'+number,
			});
		});

		socket.io.on('reconnect_error', (error) => {
			status.server.connected = false;

			log.msg({
				src : module_name,
				msg : 'reconnect error: '+error.description,
			});
		});

		socket.io.on('reconnect_failed', () => {
			status.server.connected    = false;
			status.server.connecting   = false;
			status.server.reconnecting = false;

			log.msg({
				src : module_name,
				msg : 'failed to reconnect',
			});
		});

		socket.io.on('pong', (number) => {
			status.server.latency      = number;
			status.server.connected    = true;
			status.server.connecting   = false;
			status.server.reconnecting = false;

			log.msg({
				src : module_name,
				msg : 'ping reply, latency '+number+'ms',
			});
		});

		socket.io.on('ping', () => {
			log.msg({
				src : module_name,
				msg : 'pinged server',
			});
		});

		socket.io.on('disconnect', () => {
			status.server.connected = false;

			log.msg({
				src : module_name,
				msg : 'disconnected from server',
			});
		});

		socket.io.on('data-receive', (data) => {
			data_handler.check_data(data);
		});

		// Open connection
		socket.io.open();
	},

	shutdown : (shutdown_callback) => {
		socket.check(() => {
			status.server.connecting   = false;
			status.server.reconnecting = false;

			if (status.server.connected !== false) {
				socket.io.on('disconnect', () => {
					status.server.connected = false;

					log.msg({
						src : module_name,
						msg : 'shut down',
					});

					json.reset(() => {
						shutdown_callback();
					});
				});
			}

			if (status.server.connected !== true) {
				json.reset(() => {
					shutdown_callback();
				});
			}

			socket.io.close(() => {
				log.msg({
					src : module_name,
					msg : 'io.close()',
				});
			});
		});
	},

	// Send vehicle data bus data to the WebSocket
	data_send : (data) => {
		data.host = os.hostname().split('.')[0];
		socket.check(() => {
			if (config.server.bus === true) {
				socket.io.emit('data-send', data)
			}
		});
	},

	// Send bus log messages WebSocket
	log_bus : (data) => {
		data.host = os.hostname().split('.')[0];
		socket.check(() => {
			if (config.server.bus === true) {
				// socket.io.emit('log-bus', data)
			}
		});
	},

	// Send app log messages WebSocket
	log_msg : (data) => {
		data.host = os.hostname().split('.')[0];
		socket.check(() => {
			socket.io.emit('log-msg', data)
		});
	},
;