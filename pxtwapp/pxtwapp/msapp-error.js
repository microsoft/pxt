(function () { 
  var validParameterNames = [ "httpStatus", "failureName", "failureUrl" ]; 
  
  function parseQueryParameters() { 
    var query = location.search.slice(1); 
    return query.split("&").reduce(function (queryParameters, rawPair) {
                                   var pair = rawPair.split("=").map(decodeURIComponent);
                                   queryParameters[pair[0]] = pair[1];
                                   return queryParameters;
    }, {});
  }
 
  function initialize() {
    var queryParameters = parseQueryParameters();
    validParameterNames.forEach(function (parameterName) {
                               var parameterValue = queryParameters[parameterName] || "N/A"; 
                               document.getElementById(parameterName + "Value").textContent = parameterValue;
    });
  }
  
  document.addEventListener("DOMContentLoaded", initialize);
}());
