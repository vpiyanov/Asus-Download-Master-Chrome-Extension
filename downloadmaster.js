/*
- Что делать если HEAD не поддерживается сервером?
	+ confirm()
	- настройка исключений
	- красивый диалог выбора
- что делать если в торренте много файлов?
	+ выбор всех автоматом
	- либо редирект на страницу загрузчика???
	- диалог выбора
	- настройка загрузки всех
- имя файла в nntt.org
*/

chrome.contextMenus.create({
	"title": 'Download with Asus Download Master',
	"contexts":['link'],
        "onclick": onLinkClick
});

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
	if(chromeFiltersActive && details.url == linkUrl) {
		console.log('Setting Referer request header to:', pageUrl);

		details.requestHeaders.push({
			name: 'Referer',
			value: pageUrl
		});
	}

	return {requestHeaders: details.requestHeaders};
}, {
  	urls: ["<all_urls>"],
	types: ["xmlhttprequest"]
},
["blocking", "requestHeaders"]
);


chrome.webRequest.onHeadersReceived.addListener(function(details) {
	if(chromeFiltersActive && details.url == linkUrl) {
		console.log('Deleting Set-Cookie response header');

		for (var i = 0; i < details.responseHeaders.length; ++i) {
			if (details.responseHeaders[i].name === 'Set-Cookie') {
				details.responseHeaders.splice(i, 1);
				break;
			}
		}
	}

	return {responseHeaders: details.responseHeaders};
}, {
  	urls: ["<all_urls>"],
	types: ["xmlhttprequest"]
},
["blocking", "responseHeaders"]
);

var pageUrl;
var linkUrl;
var chromeFiltersActive;

function onLinkClick(info, tab) {

	pageUrl = info.pageUrl;
	linkUrl = info.linkUrl;

	if(localStorage.url && localStorage.username && localStorage.password) {
		if(info.linkUrl.indexOf('magnet:') == 0 || info.linkUrl.indexOf('ed2k:') == 0 || info.linkUrl.indexOf('ftp:') == 0) {
			submitLinkUrl(info.linkUrl);
		} else {
			getContentType(info.linkUrl, function(contentType) {
				if(contentType) {
					if(contentType.indexOf('application/x-bittorrent') >= 0) {
						submitTorrentFile(info.linkUrl);
					} else {
						submitLinkUrl(info.linkUrl);
					}
				} else {
					alert('Failed to get content type!');
				}
			}, function() {
				if(confirm('Unable to detect the type of download automatically.\n\nWould you like to download it as URL?\n\nIf you choose "Cancel" it will be downloaded as torrent file')) {
					submitLinkUrl(info.linkUrl);
				} else {
					submitTorrentFile(info.linkUrl);
				}
			});

		}
	} else {
		alert('Please setup plugin parameters!');
	}
}


function getContentType(linkUrl, onSuccess, onFailure) {
	console.log("getContentType()", linkUrl);

	var request = new XMLHttpRequest();
	request.open("HEAD", linkUrl, true);

	request.onload = function (oEvent) {
		chromeFiltersActive = false;
		var contentType = request.getResponseHeader('Content-Type');
		if(request.status == 200 && contentType) {
			if (onSuccess) {
				onSuccess(contentType);
			}
		} else {
			if (onFailure) {
				onFailure(request.status, request.statusText);
			}
		}
	};
	chromeFiltersActive = true;
	request.send(null);
}


function submitTorrentFile(linkUrl, fileName) {
	console.log('submitTorrentFile(linkUrl):', linkUrl);
	downloadTorrentFile(linkUrl, function (arrayBuffer, fileName) {
		console.log('Successfully downloaded torrent file with length:',  new Uint8Array(arrayBuffer).byteLength, "fileName:", fileName);

		uploadTorrent(arrayBuffer, fileName, function() {
			console.log('Successfully submitted torrent file to the Download Master:', linkUrl);
			alert('Successfully submitted torrent file to the Download Master.');
		});
	});
}

function downloadTorrentFile(linkUrl, onSuccess, onFailure) {
	console.log("downloadFile()", linkUrl);

	var request = new XMLHttpRequest();
	request.open("GET", linkUrl, true);
	request.responseType = "arraybuffer";

	request.onload = function (oEvent) {
		chromeFiltersActive = false;
		var arrayBuffer = request.response;

		var fileName = extractFileName(request.getResponseHeader('Content-Disposition'));

		if(request.status == 200) {
			var contentType = request.getResponseHeader('Content-Type')
			if(contentType && contentType.indexOf('application/x-bittorrent') >=0) {
				if (onSuccess) {
					onSuccess(arrayBuffer, fileName);
				}
			} else {
				showError('Failed to download torrent file. Wrong response content type:' + contentType, request);
			}
		} else {
			showError('Failed to download torrent file.', request);
		}
	};
	
	chromeFiltersActive = true;
	request.send(null);
}

function extractFileName(contentDisposition) {
	if(contentDisposition) {
		var matchResult = /filename="(.*)"/g.exec(contentDisposition);
		if(matchResult) {
			return matchResult[1];
		}
	}
}

function uploadTorrent(arrayBuffer, fileName, onSuccess, onFailure) {
	var blob = new Blob([arrayBuffer], { type: "application/x-bittorrent"});
	
	var formData = new FormData();

	if(fileName) {
		formData.append("file", blob, fileName);
	} else {
		formData.append("file", blob, "file.torrent");
	}

	var request = new XMLHttpRequest();
	request.open("POST", localStorage.url + '/dm_uploadbt.cgi', true);
	request.setRequestHeader('Authorization', "Basic " + btoa(localStorage.username + ":" + localStorage.password));

	var errorMsgs = {
		ACK_FAIL : 'Failed to add the new download task.',
		BT_EXIST : 'The task already exists.',
		LIGHT_FULL : 'The http/ftp task list is full.',
		HEAVY_FULL : 'The BT task list is full.',
		NNTP_FULL : 'The NZB task list is full.',
		TOTAL_FULL : 'The task list is full.',
		DISK_FULL : 'There is not enough space to store the file.',
	};

	request.onload = function (oEvent) {
		if(request.status == 200 && request.responseText) {
			if(request.responseText.indexOf('BT_ACK_SUCESS') >= 0) {
				selectAllTorrentFiles(fileName, onSuccess);
				return;
			} else  if(request.responseText.indexOf('ACK_SUCESS') >= 0) {
				if (onSuccess) {
					onSuccess();
				}

				return;
			} else {
				for (var msgCode in errorMsgs) {
					if(request.responseText.indexOf(msgCode) >= 0) {
						console.error('Failed to submit task to the Download Master.\nError returned: ' + msgCode);
						alert('Failed to submit task to the Download Master.\nError returned: ' + errorMsgs[msgCode]);
						return;
					}
				}
			}
		}

		showError('Failed to submit torrent file.', request);
	};


	request.send(formData);
}

function selectAllTorrentFiles(fileName, onSuccess) {
	
	console.log('Torrent contains multiple files! Selecting all.');

	$.ajax({
		type: 'GET',
		url: localStorage.url + '/dm_uploadbt.cgi',
		data: {
			filename: fileName,
			download_type: 'All',
		},
		success: function(data) {
			if (onSuccess) {
				onSuccess();
			}
		},
		error: function(request) {
			showError('Failed to select all torrent files.', request);
		},
		beforeSend : function(req) {
		    req.setRequestHeader('Authorization', "Basic " + btoa(localStorage.username + ":" + localStorage.password));
		},
	});
}

function submitLinkUrl(linkUrl) {
	console.log('submitLinkUrl(linkUrl):', linkUrl);

	$.ajax({
		type: 'GET',
		url: localStorage.url + '/dm_apply.cgi',
		data: {
			action_mode:'DM_ADD',
			download_type: 5,
			again: 'no',
			usb_dm_url: linkUrl
		},
		success: function(data) {
			console.log('Successfully submitted link to the Download Master.');
			alert('Successfully submitted link to the Download Master.');
		},
		error: function(request) {
			showError('Failed to submit link.', request);
		},
		beforeSend : function(req) {
		    req.setRequestHeader('Authorization', "Basic " + btoa(localStorage.username + ":" + localStorage.password));
		},
	});

}

function showError(detailsText, request) {
	var text = null;
	if(request.status == 401) {
		text = 'Failed to submit task to the Download Master. Please check username and password.\n\n' + detailsText;
	} else {
		text = 'Failed to submit task to the Download Master.\n\n' + detailsText +'\nServer response:' + request.status + ' text:' + request.statusText;
	}
	console.error(text);
	alert(text);
}


