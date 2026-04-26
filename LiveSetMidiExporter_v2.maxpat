{
  "patcher": {
    "fileversion": 1,
    "appversion": {
      "major": 8,
      "minor": 6,
      "revision": 5,
      "architecture": "x64",
      "modernui": 1
    },
    "classnamespace": "box",
    "rect": [76.0, 101.0, 560.0, 248.0],
    "bglocked": 0,
    "openinpresentation": 1,
    "default_fontsize": 12.0,
    "default_fontface": 0,
    "default_fontname": "Arial",
    "gridonopen": 0,
    "gridsize": [15.0, 15.0],
    "gridsnaponopen": 0,
    "toolbarvisible": 1,
    "boxanimatetime": 200,
    "imprint": 0,
    "boxes": [
      {
        "box": {
          "id": "obj-1",
          "maxclass": "newobj",
          "text": "live.thisdevice",
          "numinlets": 1,
          "numoutlets": 2,
          "patching_rect": [20.0, 18.0, 94.0, 22.0]
        }
      },
      {
        "box": {
          "id": "obj-2",
          "maxclass": "comment",
          "text": "One-click export of all MIDI clips in the Live set to a multitrack MIDI file.",
          "linecount": 2,
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [20.0, 48.0, 500.0, 34.0],
          "presentation": 1,
          "presentation_rect": [16.0, 14.0, 504.0, 34.0]
        }
      },
      {
        "box": {
          "id": "obj-3",
          "maxclass": "live.text",
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": ["", ""],
          "patching_rect": [20.0, 98.0, 140.0, 30.0],
          "presentation": 1,
          "presentation_rect": [16.0, 66.0, 140.0, 30.0],
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_enum": ["off", "on"],
              "parameter_longname": "Export Project MIDI",
              "parameter_mmax": 1,
              "parameter_shortname": "Export MIDI",
              "parameter_type": 2
            }
          },
          "text": "Export MIDI",
          "texton": "Export MIDI",
          "varname": "export_button"
        }
      },
      {
        "box": {
          "id": "obj-4",
          "maxclass": "newobj",
          "text": "sel 1",
          "numinlets": 2,
          "numoutlets": 2,
          "outlettype": ["bang", ""],
          "patching_rect": [20.0, 140.0, 36.0, 22.0]
        }
      },
      {
        "box": {
          "id": "obj-5",
          "maxclass": "newobj",
          "text": "deferlow",
          "numinlets": 1,
          "numoutlets": 1,
          "patching_rect": [68.0, 140.0, 53.0, 22.0]
        }
      },
      {
        "box": {
          "id": "obj-6",
          "maxclass": "newobj",
          "text": "savedialog LiveSetExport.mid",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [20.0, 172.0, 170.0, 22.0]
        }
      },
      {
        "box": {
          "id": "obj-7",
          "maxclass": "newobj",
          "text": "prepend export",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [20.0, 204.0, 95.0, 22.0]
        }
      },
      {
        "box": {
          "id": "obj-8",
          "maxclass": "newobj",
          "text": "js export_live_set_v2.js",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [136.0, 204.0, 138.0, 22.0],
          "saved_object_attributes": {
            "filename": "export_live_set_v2.js",
            "parameter_enable": 0
          }
        }
      },
      {
        "box": {
          "id": "obj-9",
          "maxclass": "message",
          "text": "Ready",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [292.0, 204.0, 228.0, 22.0],
          "presentation": 1,
          "presentation_rect": [16.0, 108.0, 504.0, 22.0]
        }
      }
    ],
    "lines": [
      {
        "patchline": {
          "source": ["obj-3", 0],
          "destination": ["obj-4", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-4", 0],
          "destination": ["obj-5", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-5", 0],
          "destination": ["obj-6", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-6", 0],
          "destination": ["obj-7", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-7", 0],
          "destination": ["obj-8", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-8", 0],
          "destination": ["obj-9", 1]
        }
      }
    ],
    "dependency_cache": [
      {
        "name": "export_live_set_v2.js",
        "patcherrelativepath": ".",
        "type": "TEXT",
        "implicit": 1
      }
    ]
  }
}
