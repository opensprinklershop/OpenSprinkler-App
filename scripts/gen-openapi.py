import json

key_index = {
 "tz":1,"ntp":2,"dhcp":3,"ip1":4,"ip2":5,"ip3":6,"ip4":7,"gw1":8,"gw2":9,"gw3":10,"gw4":11,
 "hp0":12,"hp1":13,"ar":14,"ext":15,"seq":16,"sdt":17,"mas":18,"mton":19,"mtof":20,"urs":21,"rso":22,
 "wl":23,"den":24,"ipas":25,"devid":26,"con":27,"lit":28,"dim":29,"bst":30,"uwt":31,"ntp1":32,"ntp2":33,
 "ntp3":34,"ntp4":35,"lg":36,"mas2":37,"mton2":38,"mtof2":39,"fpr0":41,"fpr1":42,"re":43,"dns1":44,
 "dns2":45,"dns3":46,"dns4":47,"sar":48,"ife":49,"sn1t":50,"sn1o":51,"sn2t":52,"sn2o":53,"sn1on":54,
 "sn1of":55,"sn2on":56,"sn2of":57,"subn1":58,"subn2":59,"subn3":60,"subn4":61,"fwire":62,"laton":63,"latof":64,
 "ife2":65,"imin":66,"imax":67,"tpdv":68,"tmpCo":69,"comb":70,
 "belha":73,"belw1":74,"belw2":75,"ife3":76,"ife4":77,"rken":78,"ginv":79,"fpd0":80,"fpd1":81,"wims":82
}
booleans = {"ntp","dhcp","ar","seq","urs","rso","den","ipas","re","sar","lg","fwire","comb","rken","ginv","wims"}
ranges = {
 "tz":(0,255),"wl":(0,250),"sdt":(-32768,32767),"mas":(0,255),"mas2":(0,255),
 "mton":(-32768,32767),"mtof":(-32768,32767),"mton2":(-32768,32767),"mtof2":(-32768,32767),
 "hp0":(0,65535),"hp1":(0,65535),"con":(0,255),"lit":(0,255),"dim":(0,255),"uwt":(0,255),
 "ext":(0,247),"bst":(0,65535),
}
def opt_schema(name):
    if name in booleans:
        s={"type":"integer","enum":[0,1]}
    elif name in ranges:
        lo,hi=ranges[name]; s={"type":"integer","minimum":lo,"maximum":hi}
    else:
        s={"type":"integer"}
    s["description"]="OpenSprinkler option '%s' (/co index o%d)."%(name,key_index[name])
    return s

options_props={n:opt_schema(n) for n in sorted(key_index,key=lambda k:key_index[k])}
int_array={"type":"array","items":{"type":"integer"}}
obj_flex=lambda d:{"type":"object","description":d,"additionalProperties":True}

schemas={}
schemas["Options"]={
 "type":"object",
 "description":"Controller options as returned by /jo and changed via /co. Keys are firmware option mnemonics; unknown keys are rejected. Values are integers; firmware additionally validates exact ranges (error 17 = Out of Range).",
 "additionalProperties":False,
 "properties":options_props,
}
schemas["ProgramEntry"]={
 "type":"array",
 "description":"A single program (pd entry): [flag, days0, days1, [startTimes], [stationDurations], name]. flag bits: 0=enabled,1=useWeather,2-3=dayRestriction,4-5=scheduleType(0 weekly/1 single-run/2 monthly/3 interval),6=startType(0 repeating/1 fixed),7=dateRangeEnabled. startTimes repeating=[start,repeat,interval] or fixed=[t0,t1,t2,t3] minutes-from-midnight (-1=unused). stationDurations: per-station seconds (0=off).",
 "minItems":6,
 "prefixItems":[
   {"type":"integer","minimum":0,"maximum":255,"description":"flag"},
   {"type":"integer","minimum":0,"maximum":255,"description":"days0"},
   {"type":"integer","minimum":0,"maximum":255,"description":"days1"},
   {"type":"array","description":"start times","items":{"type":"integer","minimum":-1,"maximum":1440}},
   {"type":"array","description":"per-station durations (seconds)","items":{"type":"integer","minimum":0,"maximum":86400}},
   {"type":"string","maxLength":32,"description":"program name"},
 ],
 "items":{"type":"integer"},
}
schemas["Programs"]={
 "type":"object",
 "description":"Program data as returned by /jp and changed via /cp.",
 "additionalProperties":False,
 "properties":{
   "pd":{"type":"array","description":"Array of program definitions.","items":{"$ref":"#/components/schemas/ProgramEntry"}},
   "nprogs":{"type":"integer","minimum":0},
   "nboards":{"type":"integer","minimum":0},
   "mnp":{"type":"integer"},"mnst":{"type":"integer"},"pnsize":{"type":"integer"},
 },
}
schemas["Stations"]={
 "type":"object",
 "description":"Station data as returned by /jn and changed via /cs. Per-attribute arrays are indexed by station.",
 "additionalProperties":False,
 "properties":{
   "snames":{"type":"array","description":"Station names.","items":{"type":"string","maxLength":32}},
   "masop":dict(int_array),"masop2":dict(int_array),
   "ignore_rain":dict(int_array),"ignore_sn1":dict(int_array),"ignore_sn2":dict(int_array),
   "stn_dis":dict(int_array),"stn_spe":dict(int_array),"stn_seq":dict(int_array),
   "act_relay":dict(int_array),"stn_grp":dict(int_array),
   "maxlen":{"type":"integer"},
 },
}
schemas["Settings"]={
 "type":"object",
 "description":"Higher-level settings stored on the controller.",
 "additionalProperties":False,
 "properties":{
   "loc":{"type":"string","description":"Location (city name or lat,lon).","maxLength":128},
   "dname":{"type":"string","maxLength":32,"description":"Device name."},
   "ifkey":{"type":"string","maxLength":128,"description":"IFTTT Webhooks key."},
   "wto":obj_flex("Weather adjustment options."),
   "mqtt":obj_flex("MQTT configuration."),
   "email":obj_flex("Email notification configuration."),
   "otc":obj_flex("OpenThings Cloud configuration."),
   "influxdb":obj_flex("InfluxDB configuration."),
   "nbrd":{"type":"integer"},
 },
}
schemas["ConfigChangeSet"]={
 "type":"object",
 "description":"Partial OpenSprinkler configuration patch produced by the AI assistant. Deep-merged into the current controller configuration and applied via the standard /co, /cp, /cs API. Only the four top-level sections are allowed; unknown keys are rejected so the result stays API compatible. Analog sensors and monitors are NOT part of this changeset – they are managed separately via the /sc and /mc endpoints (see components.schemas.AnalogSensor / Monitor).",
 "additionalProperties":False,
 "minProperties":1,
 "properties":{
   "options":{"$ref":"#/components/schemas/Options"},
   "programs":{"$ref":"#/components/schemas/Programs"},
   "stations":{"$ref":"#/components/schemas/Stations"},
   "settings":{"$ref":"#/components/schemas/Settings"},
 },
}

schemas["AnalogSensor"]={
 "type":"object",
 "description":"OpenSprinklerPro analog/virtual sensor as created/updated via GET /sc and listed via /sl. Field set depends on the sensor type (see /sf for supported types). Extra runtime fields (value, data, last, data_ok) may be present.",
 "additionalProperties":True,
 "properties":{
   "nr":{"type":"integer","minimum":1,"maximum":99999,"description":"Unique sensor number."},
   "type":{"type":"integer","description":"Sensor type / driver id (see /sf)."},
   "name":{"type":"string","maxLength":40},
   "group":{"type":"integer","minimum":0,"maximum":255},
   "ip":{"type":["string","integer"],"description":"IP address (network sensors)."},
   "port":{"type":"integer","minimum":0,"maximum":65535},
   "id":{"type":"integer","description":"Device / Modbus address."},
   "ri":{"type":"integer","minimum":0,"description":"Read interval (seconds)."},
   "factor":{"type":"integer","description":"Conversion factor."},
   "divider":{"type":"integer","description":"Conversion divider."},
   "offset":{"type":"integer","minimum":-32768,"maximum":32767,"description":"Offset (mV)."},
   "unit":{"type":"string","maxLength":10},
   "unitid":{"type":"integer","description":"Chart unit id."},
   "enable":{"type":"integer","enum":[0,1]},
   "log":{"type":"integer","enum":[0,1]},
   "stdlog":{"type":"integer","enum":[0,1]},
   "show":{"type":"integer","enum":[0,1]},
   "topic":{"type":"string","maxLength":100,"description":"MQTT topic."},
   "filter":{"type":"string","maxLength":100,"description":"JSON/text filter."},
   "url":{"type":"string","description":"Remote JSON / remote OpenSprinkler URL."},
   "device_ieee":{"type":"string","description":"ZigBee IEEE address."},
   "endpoint":{"type":"integer","description":"ZigBee endpoint."},
   "cluster_id":{"type":"integer","description":"ZigBee cluster id."},
   "attribute_id":{"type":"integer","description":"ZigBee attribute id."},
   "tuya_dp":{"type":"integer"},"tuya_dp_value":{"type":"integer"},
   "tuya_dp_batt":{"type":"integer"},"tuya_dp_battery":{"type":"integer"},
   "tuya_dp_unit":{"type":"integer"},"dp_unit":{"type":"integer"},
   "poll_interval":{"type":"integer","description":"Poll interval (ms) for ZigBee/BLE."},
   "mac":{"type":"string","description":"BLE MAC address."},
   "char_uuid":{"type":"string","description":"BLE characteristic UUID."},
   "format":{"type":"integer","description":"BLE value format."},
 },
}
schemas["Monitor"]={
 "type":"object",
 "description":"OpenSprinklerPro monitor (sensor-based rule) as managed via /mc (configure), /ml (list), /mt (types).",
 "additionalProperties":True,
 "properties":{
   "nr":{"type":"integer","minimum":1},
   "name":{"type":"string","maxLength":40},
   "type":{"type":"integer","description":"Monitor type (e.g. AND/OR/XOR/remote)."},
   "enable":{"type":"integer","enum":[0,1]},
   "prio":{"type":"integer","minimum":0,"maximum":2},
   "s1":{"type":"integer","description":"Sensor 1 number."},
   "s2":{"type":"integer","description":"Sensor 2 number."},
   "min":{"type":"number"},"max":{"type":"number"},
   "time1":{"type":"string","description":"Start time HH:MM."},
   "time2":{"type":"string","description":"End time HH:MM."},
 },
}
schemas["ProgramAdjustment"]={
 "type":"object",
 "description":"Sensor-based program adjustment (links a sensor value to a program runtime).",
 "additionalProperties":True,
 "properties":{
   "nr":{"type":"integer","minimum":1},
   "name":{"type":"string","maxLength":40},
   "type":{"type":"integer"},
   "sensor":{"type":"integer","description":"Sensor number to read."},
   "prog":{"type":"integer","description":"Program id to adjust."},
   "enable":{"type":"integer","enum":[0,1]},
   "fac1":{"type":"number"},"fac2":{"type":"number"},
   "min":{"type":"number"},"max":{"type":"number"},
 },
}
schemas["AssistResponse"]={
 "type":"object","description":"Response of the /assist endpoint.",
 "properties":{
   "ok":{"type":"boolean"},"refused":{"type":"boolean"},"reason":{"type":"string"},
   "summary":{"type":"string"},"explanation":{"type":"string"},
   "changes":{"$ref":"#/components/schemas/ConfigChangeSet"},
 },
}
def jresp(ref):
    return {"description":"OK","content":{"application/json":{"schema":{"$ref":ref}}}}
paths={}
paths["/wp-json/osai/v1/assist"]={"post":{
  "summary":"Generate a validated OpenSprinkler configuration change from natural language.",
  "requestBody":{"required":True,"content":{"application/json":{"schema":{
     "type":"object","required":["message","config"],"properties":{
       "message":{"type":"string","maxLength":2000},
       "locale":{"type":"string"},"firmware":{"type":"string"},
       "config":{"type":"object","description":"Current controller configuration (secrets removed client-side)."},
     }}}}},
  "responses":{"200":jresp("#/components/schemas/AssistResponse")}}}
paths["/wp-json/osai/v1/schema"]={"get":{"summary":"Return this OpenAPI document used to validate delivered configurations.","responses":{"200":{"description":"OpenAPI document"}}}}
paths["/wp-json/osai/v1/health"]={"get":{"summary":"Service health/status.","responses":{"200":{"description":"OK"}}}}
for p,desc in [("/jc","Get controller variables."),("/jo","Get options."),("/jp","Get programs."),
               ("/jn","Get station names/attributes."),("/co","Change options."),
               ("/cp","Change program (pid=-1 to add)."),("/cs","Change stations.")]:
    paths[p]={"get":{"summary":desc,"description":"OpenSprinkler firmware endpoint (on the device, not on this service).","responses":{"200":{"description":"OK"}}}}

for p,desc in [("/sc","Configure (create/update) an analog sensor; nr identifies it, type=0 deletes."),
               ("/sl","List analog sensors and their current values."),
               ("/sf","List supported sensor types for the current build."),
               ("/so","Read/export a sensor value log (csv=1 for CSV)."),
               ("/sn","Delete a sensor value log."),
               ("/sx","Export/import sensor-only configuration."),
               ("/jw","Read monthly water-usage data."),
               ("/mc","Configure a monitor."),("/ml","List monitors."),("/mt","List/discover monitor types.")]:
    paths[p]={"get":{"summary":desc,"description":"OpenSprinklerPro firmware endpoint (on the device). See components.schemas.AnalogSensor / Monitor.","responses":{"200":{"description":"OK"}}}}

doc={
 "openapi":"3.1.0",
 "info":{"title":"OpenSprinkler AI Assistant – Configuration API","version":"1.3.1",
   "description":"Schema definition for AI-generated OpenSprinkler configuration changes. All configurations delivered by the OSAI assistant are validated against components.schemas.ConfigChangeSet to guarantee compatibility with the OpenSprinkler firmware API (/co, /cp, /cs). Also documents the OpenSprinklerPro analog-sensor / monitor API (/sc, /sl, /sf, /so, /sn, /sx, /mc, /ml, /mt). See https://opensprinklershop.github.io for firmware/API documentation. MAINTENANCE: whenever the OpenSprinkler/OSAI API changes (option keys, endpoints, program/station/sensor structures), this OpenAPI file MUST be updated in lockstep \u2013 it is the single source of truth used to validate every delivered configuration."},
 "x-maintenance":"On any API change (config keys, endpoints, analog sensor API), update this openapi.json. Source generator: scripts/gen-openapi (UI project) / OSAI plugin schema.",
 "servers":[{"url":"https://opensprinklershop.de"}],
 "paths":paths,
 "components":{"schemas":schemas},
}
import os
outs=["/data/osai-plugin/osai/schema/openapi.json","/srv/www/htdocs/ui/docs/openapi.json"]
for out in outs:
    os.makedirs(os.path.dirname(out),exist_ok=True)
    json.dump(doc,open(out,"w"),indent=2,ensure_ascii=False)
    print("wrote",out)
print("option keys:",len(options_props),"schemas:",list(schemas.keys()))
