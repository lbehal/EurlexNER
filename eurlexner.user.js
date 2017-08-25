// ==UserScript==
// @name         Eurlex NER
// @namespace    http://ladabehal.net/
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @version      0.1
// @description  Annotates Eurlex Czech text with links to EU acts 
// @author       LB
// @match        http://eur-lex.europa.eu/legal-content/CS/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
	'use strict';

	function AionNER(html, lngCode, onLoad)
	{	
		var apiKey = getIpPort();

		var nerRequest = {
			"html": html,
			"LngCode": lngCode,
			"TextDate" : "",
			"ApiKey" : apiKey
		};
		var data = JSON.stringify(nerRequest);

		GM_xmlhttpRequest({
			method: "POST",
			url: "http://ner.aionindexing.eu/api/ner",
			data: data,
			headers: {
				"User-Agent": "Mozilla/5.0",  
				"Accept": "application/json, text/javascript, */*; q=0.01",
				"Content-Type": "application/json"
			},
			onload: function(response) {
				try {						
					onLoad(JSON.parse(response.responseText));						
				}
				catch(err) {
					console.log(err);
					debugger;
				}					
			}
		});	
	}

	function setupIpPort(ipport)
	{
		ipport = prompt("Please enter your API key for NER API", "");
		GM_setValue("ner_Api", ipport);
		return ipport;
	}

	function getIpPort()
	{
		var ipport = GM_getValue("ner_Api", "");
		console.log(ipport);
		if(!ipport || 0 === ipport.length)
		{
			ipport = setupIpPort(ipport);
		}
		return ipport;
	}


	$("#text").each(function() {		
		var outherHtml = $(this).prop('outerHTML');
		AionNER(outherHtml, "CS", function(nerResult){
			//echange the result
			if(nerResult.found)
			{				
				$("#text").prop('outerHTML', nerResult.taggedHTML);
			}
		});
	});
})();
