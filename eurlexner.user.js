// ==UserScript==
// @name         Eurlex NER
// @namespace    http://ladabehal.net/
// @version      0.6
// @author       LB
// @description  Annotates Eurlex Czech text with links to EU acts
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @require      https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster.bundle.min.js
// @resource     tooltipster_css https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster.bundle.min.css
// @require      https://cdn.jsdelivr.net/clipboard.js/1.5.16/clipboard.min.js
// @resource     tooltipster_css2 https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster-sideTip-shadow.min.css
// @require      https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster-scrollableTip.min.js
// @match        https://eur-lex.europa.eu/legal-content/CS/*
// @match        https://eur-lex.europa.eu/legal-content/SK/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
	'use strict';

	var cm_CssSrc = GM_getResourceText("tooltipster_css");
	GM_addStyle (cm_CssSrc);
	var cm_CssSrc2 = GM_getResourceText("tooltipster_css2");
	GM_addStyle (cm_CssSrc2);

	var idMatch = new RegExp("^ntc.*?-E....$");
	var linkMatch = new RegExp(",[\\s\\u00A0]+[sp](?:\\.)?[\\s\\u00A0]+(\\d+)[\\s\\u00A0]*$");

	var ojUriMatch = new RegExp("uri=OJ\\:(.*?)\\:(.*?)\\:(.*?)\\:TOC");//uri=OJ:L:2006:302:TOC
	var noteLinks = [];
	var clipboard = new Clipboard('.btn');

	String.prototype.escapeSelector = function () {
    return this.replace(
        /([$%&()*+,./:;<=>?@\[\\\]^\{|}~])/g,
        '\\\\$1'
    );
};

	function escapeRegExp(str) {
		return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	}

	function sparqlQuery(sparqlQuery, onLoad)
	{
		var queryParams =
			{
				query : sparqlQuery,
				format: "application/sparql-results+json",
				timeout: "0",
				debug: "off"
			};
		var enchodedParams = $.param(queryParams);
		var url = `http://publications.europa.eu/webapi/rdf/sparql?${enchodedParams}`;
		//query sparql endpoint for the celex
		GM_xmlhttpRequest({
			method: "GET",
			url: url,
			headers: {
				"User-Agent": "Mozilla/5.0",
				"Accept": "application/json, text/javascript, */*; q=0.01"
			},
			onload: function(response) {
				try {
					var result = JSON.parse(response.responseText);
					if(result.results === null || result.results.bindings.length === 0) return;
					onLoad(result.results.bindings);
				}
				catch(err) {
					console.log(err);
					debugger;
				}
			}
		});
	}


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
			//url:"http://localhost/Indexing.NER.API/api/NER",
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

    function addResumeTab(celexes)
    {
		var oldPanel = $("#AionPanelCitated");
		if(oldPanel)
		{
			oldPanel.remove();
		}

		console.log("adding tab")
        var celexesForm = "";
        var buttonList = "<dl class='NMetadata'><dt>Citované dokumenty Aion: </dt><dd><ul id='celexList'>";
        celexes.forEach(celex =>
            {
                celexesForm += " "+ celex
                buttonList += `<li><a onclick="$('#${(celex).escapeSelector()}').get(0).scrollIntoView();this.style.color='#ff0000'" data-celex="${celex}">scroll to ${celex}</a></li>`
        });
        buttonList+="</ul></dd></dl>"

        //find text tab
       var textPanel = $("div.panel-group>div.panel:has(div.panel-heading:contains(Text))")[0];
        var celexEls = $(`<div id="AionPanelCitated" xmlns="http://www.w3.org/1999/xhtml" class="panel panel-default PagePanel">
   <div class="panel-heading" role="tab" id="PP_CitedDocs">
      <h2 class="panel-title">
         <a role="button" data-toggle="collapse" href="#PP_CitedDocs_Contents" aria-expanded="true" aria-controls="PP_CitedDocs_Contents" onclick="createDocPartCookie(this);" class="">Citované dokumenty Aion</a>
      </h2>
   </div>
   <div id="PP_CitedDocs_Contents" class="panel-collapse collapse in" role="tabpanel" aria-labelledby="PP_CitedDocs">
      <div class="panel-body">
        <button class="btn" style="margin-left:5px;margin-bottom:5px" data-clipboard-text="${celexesForm}">Copy all found celexes</button>
        ${buttonList}
      </div>
   </div>
</div>`);
        celexEls.insertBefore(textPanel);

    }

	//run NER TAGGING on the TEXT
	AionNER( $("#text").prop('outerHTML'), "CS", function(nerResult){
		debugger;
		//echange the result
		if(nerResult.found)
		{
			$("#text").prop('outerHTML', nerResult.taggedHTML);
		}
        var celexes_ = [];
		$('.tooltips').tooltipster({
			plugins: ['sideTip', 'scrollableTip'],
			theme: 'tooltipster-shadow',
			contentCloning: true,
			trigger: 'custom',
			interactive: true,
			triggerOpen: {
				mouseenter: true
			},
			triggerClose: {
				click: true,
				scroll: true
			}
		});

		//add tooltip to all notereference links
		$("#text a").each(function() {
			if(idMatch.test(this.id))//this is correct link.
			{


				$(this).addClass("tooltips"); //mark this with tooltip class so we can show a tooltip with tooltipster plugin
				var hrefid = escapeRegExp($(this).attr('href'));
				$(this).attr('data-tooltip-content', "p.note:has(a"+hrefid+")");

				var noteId = this.id.substring(this.id.length-5);
				console.log(noteId);

				noteLinks.push({element:this, noteId : noteId});
			}
		});

		$("#text a.linkeurule").each(function (){
			var el = $(this);
			var celex = el.attr("data-celex");
			if(celex === undefined) return;
			//data-id_celex
			//create button with celexid and set it up for clipboard copy..
			var celexEls = $(`<button class="btn" style="margin-left:5px" data-clipboard-text="${celex}" id="${(celex)}">${celex}</button>`);
			celexEls.insertAfter(el);

            if(celexes_.includes(celex) == false)
                celexes_.push(celex);
		});

		//add celex buttons to all OJ links
		$("#text a").each(function() {

			var el = $(this);
			var linkText = el.text().replace(/\u00a0/g, " ");
			var href = el.attr('href');
			var textOk = linkMatch.test(linkText);
			if(ojUriMatch.test(href) && textOk === true)
			{

				var match = ojUriMatch.exec(href);
				var oj = match[1];
				var year = match[2];
				var num = match[3];
				var pn = linkMatch.exec(linkText)[1];

				var pageNum = ('0000'+pn).slice(-4);

				var s_query = `prefix cdm: <http://publications.europa.eu/ontology/cdm#> select distinct ?celex where
{
?oj  cdm:official-journal_number '${num}'^^xsd:positiveInteger.
?oj cdm:publication_general_date_publication ?dp.
BIND(YEAR(xsd:datetime(?dp)) as ?year)
filter(?year = ${year})
?oj  cdm:official-journal_part_of_collection_document <http://publications.europa.eu/resource/authority/document-collection/OJ-${oj}>.
?w cdm:resource_legal_id_celex ?celex.
?w cdm:resource_legal_published_in_official-journal ?oj.
?e cdm:expression_belongs_to_work ?w.
?m cdm:manifestation_manifests_expression ?e.
?m cdm:manifestation_official-journal_part_page_first '${pageNum}'^^xsd:string.
}
`;

				sparqlQuery(s_query, function(bindings){

					if(bindings.length > 1) return;

					var celex = bindings[0].celex.value;
					var celexMsg = celex+" zkopírován do schránky";
					if(typeof celex === undefined) return;
					console.log(celex);

                    if(celexes_.includes(celex) == false)
					{
                        celexes_.push(celex);
						addResumeTab(celexes_);
					}

					//create button with celexid and set it up for clipboard copy..
					var celexEls = $(`<button class="btn" style="margin-left:5px" data-clipboard-text="${celex}"  id="${(celex)}">${celex}</button>`);
					celexEls.insertAfter(el);

					var noteEl = el.parent("p.note");
					if(noteEl !== null)
					{
						var noteLink = noteEl.children('a:first-child');
						var noteLinkId = noteLink.attr('id');
						$(`a[href='#${noteLinkId}']`).each(function()
														   {
							//this is a reference of changed notelink.
							//we will update tooltipster value for all these since tooltipster does copy the html on init.
							//var instance = $(this).tooltipster('instance');
							//instance.content(noteEl);
							$(this).tooltipster({
								plugins: ['sideTip', 'scrollableTip'],
								theme: 'tooltipster-shadow',
								contentCloning: true,
								trigger: 'custom',
								interactive: true,
								triggerOpen: {
									mouseenter: true
								},
								triggerClose: {
									click: true,
									scroll: true
								}
							}).tooltipster('content', noteEl);

						});
					}
				});
			}
		});
        var celexesForm = "";
        celexes_.forEach(item => celexesForm += " "+ item);
        console.log(celexesForm);

        addResumeTab(celexes_);
	});

})();
