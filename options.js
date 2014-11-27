

function loadOptions() {
	if(localStorage.url) {
		document.getElementById('url').value = localStorage.url;
		document.getElementById('username').value = localStorage.username;
		document.getElementById('password').value = localStorage.password;
	} else {
		setDefaults();
		storeOptions();
	}
}

function storeOptions() {
	localStorage.url = document.getElementById('url').value;
	localStorage.username = document.getElementById('username').value;
	localStorage.password = document.getElementById('password').value;
}

function setDefaults() {
	document.getElementById('url').value = 'http://192.168.1.1:8081/downloadmaster';
	document.getElementById('username').value = 'admin';
	document.getElementById('password').value = 'admin';
}


window.onload = function() {

	loadOptions();

	document.getElementById('url').onchange = storeOptions;
	document.getElementById('url').onkeyup = storeOptions;
	document.getElementById('username').onchange = storeOptions;
	document.getElementById('username').onkeyup = storeOptions;
	document.getElementById('password').onchange = storeOptions;
	document.getElementById('password').onkeyup = storeOptions;
/*
  document.getElementById('new').onclick = function() {
    new Rule();
  };
*/
}
