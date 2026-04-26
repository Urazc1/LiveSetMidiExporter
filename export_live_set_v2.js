autowatch = 1;
inlets = 1;
outlets = 1;

var PPQ = 480;
var SESSION_GAP_BEATS = 4;
var WRITE_CHUNK_SIZE = 4096;

function anything() {
    var args = arrayfromargs(messagename, arguments);
    if (!args.length) {
        return;
    }

    if (args[0] === "export") {
        args.shift();
        exportFile(args.join(" "));
    } else if (args[0] === "ping") {
        logStatus("LiveSetMidiExporter v2 ready.");
    }
}

function bang() {
    logStatus("Use the Export button to choose a .mid file path.");
}

function exportFile(path) {
    if (!path) {
        logStatus("No output path received.");
        return;
    }

    try {
        var normalizedPath = ensureMidExtension(path.toString());
        var exportData = collectLiveSetData();

        if (!exportData.tracks.length) {
            logStatus("No MIDI clips were found in the Live set.");
            return;
        }

        var bytes = buildMidiFile(exportData);
        writeBytesToFile(normalizedPath, bytes);

        logStatus("Exported " + exportData.trackCount + " tracks / " + exportData.clipCount + " clips / " + bytes.length + " bytes to " + normalizedPath);
    } catch (err) {
        logStatus("Export failed: " + err);
        error("[LiveSetMidiExporter_v2] " + err + "\n");
    }
}

function ensureMidExtension(path) {
    return path.toLowerCase().slice(-4) === ".mid" ? path : path + ".mid";
}

function collectLiveSetData() {
    var song = new LiveAPI("live_set");
    var trackCount = safeGetCount(song, "tracks");
    var resultTracks = [];
    var totalClips = 0;
    var tempo = getNumberProperty(song, "tempo", 120);

    for (var i = 0; i < trackCount; i++) {
        var trackPath = "live_set tracks " + i;
        var collected = collectTrack(trackPath, i);
        if (!collected) {
            continue;
        }
        resultTracks.push(collected.trackData);
        totalClips += collected.clipCount;
    }

    return {
        tempo: tempo,
        tracks: resultTracks,
        trackCount: resultTracks.length,
        clipCount: totalClips
    };
}

function collectTrack(trackPath, trackIndex) {
    var trackApi = new LiveAPI(trackPath);
    var trackName = getStringProperty(trackApi, "name", "Track " + (trackIndex + 1));
    var notes = [];
    var clipCount = 0;

    clipCount += collectArrangementFamily(trackPath, notes);
    clipCount += collectSessionFamily(trackPath, notes);

    if (!notes.length) {
        return null;
    }

    notes.sort(compareExportNotes);

    return {
        trackData: {
            name: trackName,
            midiChannel: trackIndex % 16,
            notes: notes
        },
        clipCount: clipCount
    };
}

function collectArrangementFamily(trackPath, targetNotes) {
    var clipRefs = [];
    var trackApi = new LiveAPI(trackPath);

    if (supportsChild(trackApi, "arrangement_clips")) {
        appendArrangementClipRefs(trackPath, "arrangement_clips", clipRefs);
    }

    if (supportsChild(trackApi, "take_lanes")) {
        var laneCount = safeGetCount(trackApi, "take_lanes");
        for (var laneIndex = 0; laneIndex < laneCount; laneIndex++) {
            var lanePath = trackPath + " take_lanes " + laneIndex;
            appendArrangementClipRefs(lanePath, "arrangement_clips", clipRefs);
        }
    }

    clipRefs.sort(function (a, b) {
        return a.songStart - b.songStart;
    });

    var clipCount = 0;
    for (var i = 0; i < clipRefs.length; i++) {
        var notes = renderClipToSongTimeline(clipRefs[i].api, clipRefs[i].songStart);
        if (!notes.length) {
            continue;
        }
        appendNotes(targetNotes, notes);
        clipCount++;
    }

    return clipCount;
}

function appendArrangementClipRefs(ownerPath, childName, target) {
    var ownerApi = new LiveAPI(ownerPath);
    if (!supportsChild(ownerApi, childName)) {
        return;
    }

    var count = safeGetCount(ownerApi, childName);
    for (var i = 0; i < count; i++) {
        var clipApi = new LiveAPI(ownerPath + " " + childName + " " + i);
        if (!isMidiClip(clipApi)) {
            continue;
        }
        target.push({
            api: clipApi,
            songStart: getNumberProperty(clipApi, "start_time", 0)
        });
    }
}

function collectSessionFamily(trackPath, targetNotes) {
    var trackApi = new LiveAPI(trackPath);
    if (!supportsChild(trackApi, "clip_slots")) {
        return 0;
    }

    var cursor = getArrangementEnd(trackPath);
    var clipCount = 0;
    var slotCount = safeGetCount(trackApi, "clip_slots");

    for (var slotIndex = 0; slotIndex < slotCount; slotIndex++) {
        var slotApi = new LiveAPI(trackPath + " clip_slots " + slotIndex);
        if (!getNumberProperty(slotApi, "has_clip", 0)) {
            continue;
        }

        var clipApi = new LiveAPI(trackPath + " clip_slots " + slotIndex + " clip");
        if (!isMidiClip(clipApi)) {
            continue;
        }

        var notes = renderClipToSongTimeline(clipApi, cursor);
        if (!notes.length) {
            continue;
        }

        appendNotes(targetNotes, notes);
        clipCount++;
        cursor += getClipPlaybackSpan(clipApi) + SESSION_GAP_BEATS;
    }

    return clipCount;
}

function getArrangementEnd(trackPath) {
    var clipRefs = [];
    var trackApi = new LiveAPI(trackPath);

    if (supportsChild(trackApi, "arrangement_clips")) {
        appendArrangementClipRefs(trackPath, "arrangement_clips", clipRefs);
    }

    if (supportsChild(trackApi, "take_lanes")) {
        var laneCount = safeGetCount(trackApi, "take_lanes");
        for (var laneIndex = 0; laneIndex < laneCount; laneIndex++) {
            appendArrangementClipRefs(trackPath + " take_lanes " + laneIndex, "arrangement_clips", clipRefs);
        }
    }

    var maxEnd = 0;
    for (var i = 0; i < clipRefs.length; i++) {
        maxEnd = Math.max(maxEnd, getNumberProperty(clipRefs[i].api, "end_time", clipRefs[i].songStart));
    }
    return maxEnd;
}

function renderClipToSongTimeline(clipApi, songStart) {
    var rawNotes = getAllClipNotes(clipApi);
    if (!rawNotes.length) {
        return [];
    }

    rawNotes.sort(compareRawNotes);

    var clipStart = getNumberProperty(clipApi, "start_marker", 0);
    var clipEnd = getNumberProperty(clipApi, "end_time", clipStart);
    var looping = !!getNumberProperty(clipApi, "looping", 0);
    var loopStart = getNumberProperty(clipApi, "loop_start", clipStart);
    var loopEnd = getNumberProperty(clipApi, "loop_end", clipEnd);
    var rendered = [];

    if (!looping || loopEnd <= loopStart || clipEnd <= loopEnd) {
        appendSegmentNotes(rendered, rawNotes, clipStart, clipEnd, songStart - clipStart);
        return rendered;
    }

    appendSegmentNotes(rendered, rawNotes, clipStart, loopEnd, songStart - clipStart);

    var loopLength = loopEnd - loopStart;
    var remaining = clipEnd - loopEnd;
    var segmentSongStart = songStart + (loopEnd - clipStart);

    while (remaining > 0) {
        var segmentLength = Math.min(loopLength, remaining);
        appendSegmentNotes(rendered, rawNotes, loopStart, loopStart + segmentLength, segmentSongStart - loopStart);
        segmentSongStart += segmentLength;
        remaining -= segmentLength;
    }

    return rendered;
}

function appendSegmentNotes(target, rawNotes, segmentStart, segmentEnd, songOffset) {
    for (var i = 0; i < rawNotes.length; i++) {
        var note = rawNotes[i];
        if (note.mute) {
            continue;
        }

        var noteStart = note.time;
        var noteEnd = note.time + note.duration;
        var clippedStart = Math.max(noteStart, segmentStart);
        var clippedEnd = Math.min(noteEnd, segmentEnd);

        if (clippedEnd <= clippedStart) {
            continue;
        }

        target.push({
            pitch: note.pitch,
            startBeats: songOffset + clippedStart,
            durationBeats: clippedEnd - clippedStart,
            velocity: note.velocity
        });
    }
}

function getClipPlaybackSpan(clipApi) {
    var startMarker = getNumberProperty(clipApi, "start_marker", 0);
    var endTime = getNumberProperty(clipApi, "end_time", startMarker);
    return Math.max(0, endTime - startMarker);
}

function getAllClipNotes(clipApi) {
    var raw = clipApi.call("get_all_notes_extended");
    return parseExtendedNotes(raw);
}

function parseExtendedNotes(raw) {
    var payload = parseDictLike(raw);
    if (!payload || !(payload.notes instanceof Array)) {
        return [];
    }

    var result = [];
    for (var i = 0; i < payload.notes.length; i++) {
        var note = payload.notes[i];
        result.push({
            pitch: clampMidi(parseInt(note.pitch, 10) || 0),
            time: parseFloat(note.start_time) || 0,
            duration: Math.max(0, parseFloat(note.duration) || 0),
            velocity: clampMidi(Math.round(parseFloat(note.velocity) || 100)),
            mute: note.mute ? 1 : 0
        });
    }
    return result;
}

function parseDictLike(raw) {
    if (!raw) {
        return null;
    }

    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch (err) {
            return null;
        }
    }

    if (raw instanceof Array && raw.length >= 2 && raw[0] === "dictionary") {
        try {
            var dict = new Dict(raw[1]);
            return JSON.parse(dict.stringify());
        } catch (err2) {
            return null;
        }
    }

    return null;
}

function compareRawNotes(a, b) {
    if (a.time !== b.time) {
        return a.time - b.time;
    }
    if (a.pitch !== b.pitch) {
        return a.pitch - b.pitch;
    }
    return a.duration - b.duration;
}

function compareExportNotes(a, b) {
    if (a.startBeats !== b.startBeats) {
        return a.startBeats - b.startBeats;
    }
    if (a.pitch !== b.pitch) {
        return a.pitch - b.pitch;
    }
    return a.durationBeats - b.durationBeats;
}

function appendNotes(target, source) {
    for (var i = 0; i < source.length; i++) {
        target.push(source[i]);
    }
}

function isMidiClip(clipApi) {
    return !!getNumberProperty(clipApi, "is_midi_clip", 0);
}

function buildMidiFile(exportData) {
    var allBytes = [];
    var trackChunks = [buildConductorTrack(exportData.tempo)];

    for (var i = 0; i < exportData.tracks.length; i++) {
        trackChunks.push(buildNoteTrack(exportData.tracks[i]));
    }

    pushAscii(allBytes, "MThd");
    pushUInt32(allBytes, 6);
    pushUInt16(allBytes, 1);
    pushUInt16(allBytes, trackChunks.length);
    pushUInt16(allBytes, PPQ);

    for (var j = 0; j < trackChunks.length; j++) {
        pushAscii(allBytes, "MTrk");
        pushUInt32(allBytes, trackChunks[j].length);
        pushBytes(allBytes, trackChunks[j]);
    }

    return allBytes;
}

function buildConductorTrack(tempo) {
    var bytes = [];
    var usPerQuarter = Math.round(60000000 / Math.max(1, tempo));

    bytes.push(0x00, 0xFF, 0x51, 0x03);
    bytes.push((usPerQuarter >> 16) & 0xFF);
    bytes.push((usPerQuarter >> 8) & 0xFF);
    bytes.push(usPerQuarter & 0xFF);

    bytes.push(0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
    bytes.push(0x00, 0xFF, 0x2F, 0x00);
    return bytes;
}

function buildNoteTrack(trackData) {
    var events = [];
    var channel = trackData.midiChannel & 0x0F;

    for (var i = 0; i < trackData.notes.length; i++) {
        var note = trackData.notes[i];
        var startTick = beatsToTicks(note.startBeats);
        var endTick = beatsToTicks(note.startBeats + note.durationBeats);

        events.push({
            tick: startTick,
            order: 1,
            bytes: [0x90 | channel, clampMidi(note.pitch), clampMidi(note.velocity)]
        });
        events.push({
            tick: Math.max(startTick, endTick),
            order: 0,
            bytes: [0x80 | channel, clampMidi(note.pitch), 0]
        });
    }

    events.sort(function (a, b) {
        if (a.tick !== b.tick) {
            return a.tick - b.tick;
        }
        return a.order - b.order;
    });

    var bytes = [];
    var trackNameBytes = stringToAsciiBytes(trackData.name);

    bytes.push(0x00, 0xFF, 0x03);
    writeVarLen(bytes, trackNameBytes.length);
    pushBytes(bytes, trackNameBytes);

    var previousTick = 0;
    for (var j = 0; j < events.length; j++) {
        writeVarLen(bytes, events[j].tick - previousTick);
        pushBytes(bytes, events[j].bytes);
        previousTick = events[j].tick;
    }

    bytes.push(0x00, 0xFF, 0x2F, 0x00);
    return bytes;
}

function beatsToTicks(beats) {
    return Math.max(0, Math.round(beats * PPQ));
}

function writeBytesToFile(path, bytes) {
    var file = new File(path, "write");
    if (!file.isopen) {
        throw new Error("Cannot open output file: " + path);
    }
    file.position = 0;
    file.eof = 0;

    for (var offset = 0; offset < bytes.length; offset += WRITE_CHUNK_SIZE) {
        file.writebytes(bytes.slice(offset, offset + WRITE_CHUNK_SIZE));
    }

    file.eof = bytes.length;
    file.close();
}

function getNumberProperty(api, propertyName, fallbackValue) {
    var value;
    try {
        value = api.get(propertyName);
    } catch (err) {
        return fallbackValue;
    }

    if (value === null || typeof value === "undefined") {
        return fallbackValue;
    }

    if (value instanceof Array) {
        if (value.length === 2 && value[0] === propertyName) {
            value = value[1];
        } else if (value.length) {
            value = value[value.length - 1];
        }
    }

    var numeric = parseFloat(value);
    return isNaN(numeric) ? fallbackValue : numeric;
}

function getStringProperty(api, propertyName, fallbackValue) {
    var value;
    try {
        value = api.get(propertyName);
    } catch (err) {
        return fallbackValue;
    }

    if (value === null || typeof value === "undefined") {
        return fallbackValue;
    }

    if (value instanceof Array) {
        if (value.length === 2 && value[0] === propertyName) {
            return value[1].toString();
        }
        return value.join(" ");
    }

    return value.toString();
}

function safeGetCount(api, childName) {
    if (!supportsChild(api, childName)) {
        return 0;
    }
    try {
        return api.getcount(childName);
    } catch (err) {
        return 0;
    }
}

function supportsChild(api, childName) {
    try {
        var children = api.children;
        if (children && children.length) {
            for (var i = 0; i < children.length; i++) {
                if (children[i] === childName) {
                    return true;
                }
            }
        }
    } catch (err) {
    }
    return false;
}

function clampMidi(value) {
    return Math.max(0, Math.min(127, value));
}

function logStatus(message) {
    outlet(0, message);
    post("[LiveSetMidiExporter_v2] " + message + "\n");
}

function pushAscii(target, text) {
    for (var i = 0; i < text.length; i++) {
        target.push(text.charCodeAt(i) & 0x7F);
    }
}

function stringToAsciiBytes(text) {
    var bytes = [];
    var safe = text || "";
    for (var i = 0; i < safe.length; i++) {
        var code = safe.charCodeAt(i);
        bytes.push(code > 127 ? 63 : code);
    }
    return bytes;
}

function pushUInt16(target, value) {
    target.push((value >> 8) & 0xFF);
    target.push(value & 0xFF);
}

function pushUInt32(target, value) {
    target.push((value >> 24) & 0xFF);
    target.push((value >> 16) & 0xFF);
    target.push((value >> 8) & 0xFF);
    target.push(value & 0xFF);
}

function pushBytes(target, source) {
    for (var i = 0; i < source.length; i++) {
        target.push(source[i] & 0xFF);
    }
}

function writeVarLen(target, value) {
    var buffer = value & 0x7F;

    while ((value >>= 7)) {
        buffer <<= 8;
        buffer |= ((value & 0x7F) | 0x80);
    }

    while (true) {
        target.push(buffer & 0xFF);
        if (buffer & 0x80) {
            buffer >>= 8;
        } else {
            break;
        }
    }
}
