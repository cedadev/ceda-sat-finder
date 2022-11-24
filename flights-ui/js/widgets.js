function clearAggregatedVariables() {
    var select = $('#var_multiselect').html('');
    select.multiSelect('refresh');
    var select = $('#inst_multiselect').html('');
    select.multiSelect('refresh');
    var select = $('#coll_multiselect').html('');
    select.multiSelect('refresh');
}

function displayAggregatedVariables(buckets, wname) {
    var select, i;

    select = $(wname);
    for (i = 0; i < buckets.length; i += 1) {
        select.multiSelect('addOption', {
            value: buckets[i].key,
            text: (buckets[i].key + ' (' + buckets[i].doc_count + ')')
        });
    }
}

function requestFromMultiselect(wname) {
    var i, select, req;
    req = [];
    select = $(wname).val();

    if (select) {
        for (i of select) {
            req.push(i);
        }
    }
    return req;
}

function refreshMultiselects(){
    $('#var_multiselect').empty().multiSelect('refresh')
    $('#inst_multiselect').empty().multiSelect('refresh')
    $('#coll_multiselect').empty().multiSelect('refresh')
}

function requestFromFlightNum(){
    var fn;
    fn = $('#fnumtext').val();
    if (fn){
        if (typeof fn == "object"){
            return fn.split(' ');
        }
        else{
            return fn;
        }
    }
}

function requestFromFlightPop(){
    var fpoptext;
    fpoptext = $('#fpoptext').val();
    if (fpoptext){
        return fpoptext;
    }
    else {
        return "40";
    }
}

function requestFromKeyword(){
    var kw, kwtext, kwargs, req;

    kwtext = $('#kwtext').val();
    req = [];
    if (kwtext) {
        kwargs = kwtext.split(' ');
        for (kw of kwargs) {
            req.push(kw.toLowerCase());
        }
        return req;
    }
}
