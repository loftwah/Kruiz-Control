/**
 * Connect to Streamlabs OBS JSON RPC API and setup the event handlers
 * @param {Handler} slobsHandler handler to mark successful initialization
 * @param {string} token SLOBS API Token
 * @param {function} onSwitchScenes handle switch scene messages
 * @param {function} onStreamStart handle stream start messages
 * @param {function} onStreamStop handle stream stop messages
 */
 function connectSLOBSWebsocket(slobsHandler, token, onSwitchScenes, onStreamStarted, onStreamStopped) {
  var socket = new SockJS('http://127.0.0.1:59650/api');
  var slobsSocket = {
    requestId: 1,
    socket: socket,
    scenes: {},
    activeScene: ''
  };

  socket.onopen = () => {
    slobsHandler.success();
    slobsSocket.sendSLOBS("auth", "TcpServerService", [token])
    slobsSocket.sendSLOBS("getScenes", "ScenesService");
    slobsSocket.sendSLOBS("activeScene", "ScenesService");
    slobsSocket.sendSLOBS("sceneSwitched", "ScenesService");
    slobsSocket.sendSLOBS("sceneAdded", "ScenesService");
    slobsSocket.sendSLOBS("sceneRemoved", "ScenesService");
  };

  socket.onmessage = (e) => {
    if (e.type === 'message') {
      var data = JSON.parse(e.data);
      if (data.id === 2) {
        data.result.forEach(scene => {
          slobsSocket.scenes[scene.name] = scene;
        });
      } else if (data.id === 3) {
        slobsSocket.activeScene = data.result.name;
      } else if (data.result && data.result.resourceId === 'ScenesService.sceneAdded' && data.result.data) {
        slobsSocket.scenes[data.result.data.name] = data.result.data;
      } else if (data.result && data.result.resourceId === 'ScenesService.sceneRemoved' && data.result.data) {
        delete slobsSocket.scenes[data.result.data.name];
      } else if (data.result && data.result.resourceId === 'ScenesService.sceneSwitched' && data.result.data) {
        slobsSocket.activeScene = data.result.data.name;
        onSwitchScenes(data.result.data);
      } else if (data.result && data.result.resourceId === 'StreamingService.streamingStatusChange' && data.result.data) {
        if (data.result.data === 'starting') {
          onStreamStarted();
        } else if (data.result.data === 'ending') {
          onStreamStopped();
        }
      }
    }
  };

  socket.onclose = (e) => {
    console.log('Closed SLOBS connection', e);
  };

  slobsSocket.getCurrentScene = function() {
    return slobsSocket.activeScene;
  }

  slobsSocket.setCurrentScene = function(scene) {
    if (slobsSocket.scenes[scene]) {
      var current = slobsSocket.activeScene;
      slobsSocket.sendSLOBS('makeSceneActive', 'ScenesService', [slobsSocket.scenes[scene].id])
      return {previous_scene: current};
    } else {
      console.error('No scene found with name', scene);
    }
  }

  slobsSocket.setSourceVisibility = function(scene, source, enabled) {
    scene = scene || slobsSocket.activeScene;
    var sceneInfo = slobsSocket.scenes[scene];
    if (sceneInfo) {
      sceneInfo.nodes.forEach(sceneItem => {
        if (sceneItem.name === source) {
          var sceneItemId = `SceneItem["${sceneInfo.id}","${sceneItem.id}","${sceneItem.sourceId}"]`;
          slobsSocket.sendSLOBS("setVisibility", sceneItemId, [enabled]);
        }
      });
    }
  }

  slobsSocket.flipSourceX = function(scene, source) {
    scene = scene || slobsSocket.activeScene;
    var sceneInfo = slobsSocket.scenes[scene];
    if (sceneInfo) {
      sceneInfo.nodes.forEach(sceneItem => {
        if (sceneItem.name === source) {
          var sceneItemId = `SceneItem["${sceneInfo.id}","${sceneItem.id}","${sceneItem.sourceId}"]`;
          slobsSocket.sendSLOBS("flipX", sceneItemId);
        }
      });
    }
  }

  slobsSocket.flipSourceY = function(scene, source) {
    scene = scene || slobsSocket.activeScene;
    var sceneInfo = slobsSocket.scenes[scene];
    if (sceneInfo) {
      sceneInfo.nodes.forEach(sceneItem => {
        if (sceneItem.name === source) {
          var sceneItemId = `SceneItem["${sceneInfo.id}","${sceneItem.id}","${sceneItem.sourceId}"]`;
          slobsSocket.sendSLOBS("flipY", sceneItemId);
        }
      });
    }
  }

  slobsSocket.rotateSource = function(scene, source, degree) {
    scene = scene || slobsSocket.activeScene;
    var sceneInfo = slobsSocket.scenes[scene];
    if (sceneInfo) {
      sceneInfo.nodes.forEach(sceneItem => {
        if (sceneItem.name === source) {
          var sceneItemId = `SceneItem["${sceneInfo.id}","${sceneItem.id}","${sceneItem.sourceId}"]`;
          slobsSocket.sendSLOBS("setTransform", sceneItemId, [{rotation: degree}]);
        }
      });
    }
  }

  slobsSocket.sendSLOBS = function(method, resource, args) {
    args = args || [];
    var request = {
      jsonrpc: "2.0",
      method: method,
      params: {
        resource: resource,
        args: args
      },
      id: slobsSocket.requestId++
    }
    slobsSocket.socket.send(JSON.stringify(request));
  }

  return slobsSocket;
}
