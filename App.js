import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  ImageBackground,
  Image,
  Alert,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

export default function App() {
  const checklistTemplates = {
    digger: [
      {
        title: "Digger (Excavator) Pre-Start Checks",
        items: [
          "No visible damage",
          "No hydraulic leaks",
          "Tracks in good condition",
          "Bucket secure",
          "Pins & bushes greased",
          "Handrails secure",
        ],
      },
      {
        title: "Fluid Levels",
        items: [
          "Engine oil OK",
          "Hydraulic oil OK",
          "Coolant OK",
          "Fuel sufficient",
        ],
      },
      {
        title: "Cab & Controls",
        items: [
          "Seatbelt working",
          "Horn operational",
          "Controls responsive",
          "No warning lights",
        ],
      },
    ],

    trailer: [
      {
        title: "General Condition",
        items: [
          "No structural damage",
          "Deck in good condition",
          "Ramps secure",
        ],
      },
      {
        title: "Tyres & Wheels",
        items: [
          "Tyres inflated",
          "Wheel nuts secure",
          "No uneven wear",
        ],
      },
      {
        title: "Lights & Electrical",
        items: [
          "Brake lights working",
          "Indicators working",
          "Tail lights working",
          "Plug secure",
        ],
      },
    ],

    truck: [
      {
        title: "Vehicle Checks",
        items: [
          "Brake oil",
          "Radiator fluid",
          "Battery condition",
          "Tyres & wheel nuts",
          "Horn",
          "Lights",
          "Pressure leaks",
          "Fire extinguisher",
          "Reversing beeper",
        ],
      },
      {
        title: "Compliance",
        items: [
          "Rego current",
          "WOF / COF current",
          "Road User Charges current",
        ],
      },
    ],
  };

  const [selectedTemplate, setSelectedTemplate] =
    useState("truck");

  const [collapsedSections, setCollapsedSections] =
    useState({});

  const [operator, setOperator] = useState("");
  const [machine, setMachine] = useState("");
  const [hours, setHours] = useState("");
  const [wofExpiry, setWofExpiry] =
    useState("");
  const [regoExpiry, setRegoExpiry] =
    useState("");
  const [rucExpiry, setRucExpiry] =
    useState("");
  const [notes, setNotes] = useState("");

  const [photo, setPhoto] = useState(null);

  const [answers, setAnswers] = useState(
    {}
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const setAnswer = (key, value) => {
    setAnswers({
      ...answers,
      [key]: value,
    });
  };

  const toggleSection = (title) => {
    setCollapsedSections({
      ...collapsedSections,
      [title]: !collapsedSections[title],
    });
  };

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Camera access is needed"
      );
      return;
    }

    const result =
      await ImagePicker.launchCameraAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setAnswers({});
    setOperator("");
    setMachine("");
    setHours("");
    setWofExpiry("");
    setRegoExpiry("");
    setRucExpiry("");
    setNotes("");
    setPhoto(null);
    setCollapsedSections({});
  };

  const submitForm = () => {
    if (!validateForm()) return;

    const templateParams = {
      operator,
      (async () => {
        setIsSubmitting(true);

        try {
          let photoBase64 = null;
          let photoName = null;
          let photoType = null;

          if (photo) {
            // read file as base64
            photoBase64 = await FileSystem.readAsStringAsync(photo, { encoding: FileSystem.EncodingType.Base64 });
            photoName = photo.split("/").pop();
            // try to infer type from extension
            if (photoName && photoName.endsWith(".png")) photoType = "image/png";
            else photoType = "image/jpeg";
          }

          const payload = {
            operator,
            machine,
            hours,
            wofExpiry,
            regoExpiry,
            rucExpiry,
            notes,
            answers,
            photoBase64,
            photoName,
            photoType,
          };

          const resp = await fetch("/.netlify/functions/sendChecklist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await resp.json();

          if (resp.ok) {
            Alert.alert("Success", "Checklist emailed successfully");
            resetForm();
          } else {
            Alert.alert("Server Error", result.error || "Unknown error");
          }
        } catch (err) {
          Alert.alert("Request Failed", String(err));
        } finally {
          setIsSubmitting(false);
        }
      })();
        }
      } catch (err) {
        Alert.alert("Email Failed", String(err));
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const validateForm = () => {
    if (!operator || !operator.trim()) {
      Alert.alert("Validation", "Please enter Operator Name.");
      return false;
    }

    if (!machine || !machine.trim()) {
      Alert.alert("Validation", "Please enter Machine ID / Rego.");
      return false;
    }

    return true;
  };

  const switchTemplate = (template) => {
    setSelectedTemplate(template);
    resetForm();
  };

  const CheckRow = ({
    label,
    value,
    keyName,
  }) => (
    <View style={styles.checkRow}>
      <Text style={styles.checkText}>
        {label}
      </Text>

      <View style={styles.buttonGroup}>
        {/* PASS */}
        <TouchableOpacity
          style={[
            styles.checkButton,
            value === "tick" &&
              styles.checkButtonActive,
            isSubmitting && styles.disabledControl,
          ]}
          onPress={() =>
            setAnswer(keyName, "tick")
          }
          disabled={isSubmitting}
        >
          <Text style={styles.tick}>✓</Text>
        </TouchableOpacity>

        {/* FAIL */}
        <TouchableOpacity
          style={[
            styles.xButton,
            value === "cross" &&
              styles.xButtonActive,
            isSubmitting && styles.disabledControl,
          ]}
          onPress={() =>
            setAnswer(keyName, "cross")
          }
          disabled={isSubmitting}
        >
          <Text style={styles.xText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ImageBackground
      source={require("./assets/bg.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
        >
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image
              source={require("./assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* TABS */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tab,
                selectedTemplate ===
                  "truck" &&
                  styles.activeTab,
              ]}
              onPress={() =>
                switchTemplate("truck")
              }
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTemplate ===
                    "truck" &&
                    styles.activeTabText,
                ]}
              >
                Truck/Ute
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                selectedTemplate ===
                  "digger" &&
                  styles.activeTab,
              ]}
              onPress={() =>
                switchTemplate("digger")
              }
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTemplate ===
                    "digger" &&
                    styles.activeTabText,
                ]}
              >
                Digger
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                selectedTemplate ===
                  "trailer" &&
                  styles.activeTab,
              ]}
              onPress={() =>
                switchTemplate("trailer")
              }
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTemplate ===
                    "trailer" &&
                    styles.activeTabText,
                ]}
              >
                Trailer
              </Text>
            </TouchableOpacity>
          </View>

          {/* INFO CARD */}
          <View style={styles.card}>
            <TextInput
              placeholder="Operator Name"
              placeholderTextColor="#666"
              style={styles.input}
              value={operator}
              onChangeText={setOperator}
              editable={!isSubmitting}
            />

            <TextInput
              placeholder="Machine ID / Rego"
              placeholderTextColor="#666"
              style={styles.input}
              value={machine}
              onChangeText={setMachine}
              editable={!isSubmitting}
            />

            {/* TRUCK */}
            {selectedTemplate ===
              "truck" && (
              <>
                <TextInput
                  placeholder="Hours / KMs"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={hours}
                  onChangeText={setHours}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="WOF / COF Expiry"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={wofExpiry}
                  onChangeText={setWofExpiry}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Registration Expiry"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={regoExpiry}
                  onChangeText={setRegoExpiry}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="RUC Expiry"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={rucExpiry}
                  onChangeText={setRucExpiry}
                  editable={!isSubmitting}
                />
              </>
            )}

            {/* TRAILER */}
            {selectedTemplate ===
              "trailer" && (
              <>
                <TextInput
                  placeholder="Trailer Registration Expiry"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={regoExpiry}
                  onChangeText={setRegoExpiry}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Trailer WOF Expiry"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={wofExpiry}
                  onChangeText={setWofExpiry}
                  editable={!isSubmitting}
                />
              </>
            )}
          </View>

          {/* CHECKLISTS */}
          {checklistTemplates[
            selectedTemplate
          ].map((section, index) => (
            <View
              key={index}
              style={styles.section}
            >
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() =>
                  toggleSection(section.title)
                }
              >
                <Text
                  style={styles.sectionTitle}
                >
                  {section.title}
                </Text>

                <Text style={styles.arrow}>
                  {collapsedSections[
                    section.title
                  ]
                    ? "⌄"
                    : "⌃"}
                </Text>
              </TouchableOpacity>

              {!collapsedSections[
                section.title
              ] && (
                <View
                  style={styles.sectionContent}
                >
                  {section.items.map(
                    (item, itemIndex) => {
                      const key = `${index}-${itemIndex}`;

                      return (
                        <CheckRow
                          key={key}
                          label={item}
                          value={
                            answers[key]
                          }
                          keyName={key}
                        />
                      );
                    }
                  )}
                </View>
              )}
            </View>
          ))}

          {/* NOTES */}
          <View style={styles.card}>
              <TouchableOpacity
                onPress={pickImage}
                disabled={isSubmitting}
                style={[styles.photoButton, isSubmitting && styles.disabledButton]}
            >
              <Text
                style={styles.photoText}
              >
                📷 Upload Fault Photos
              </Text>
            </TouchableOpacity>

            {photo && (
              <Image
                source={{ uri: photo }}
                style={styles.photoPreview}
              />
            )}

            <TextInput
              placeholder="Describe any issues or faults..."
              placeholderTextColor="#666"
              multiline
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              editable={!isSubmitting}
            />
          </View>

          {/* SUBMIT */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            onPress={submitForm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>
                SUBMIT PRESTART
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.55)",
  },

  logoContainer: {
    alignItems: "center",
    marginTop: 55,
    marginBottom: 6,
  },

  logo: {
    width: 300,
    height: 110,
  },

  tabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginHorizontal: 12,
  },

  activeTab: {
    backgroundColor: "#D7FF2F",
    shadowColor: "#D7FF2F",
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
  },

  tab: {
    flex: 1,
    backgroundColor: "#111",
    paddingVertical: 16,
    borderRadius: 22,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2c2c2c",
  },

  activeTabText: {
    color: "#000",
  },

  tabText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  card: {
    backgroundColor:
      "rgba(10,10,10,0.58)",
    marginTop: 20,
    marginHorizontal: 18,
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",
  },

  input: {
    backgroundColor: "#050505",
    color: "#fff",
    fontSize: 18,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },

  section: {
    backgroundColor:
      "rgba(10,10,10,0.58)",
    marginTop: 20,
    marginHorizontal: 18,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    color: "#D7FF2F",
    fontSize: 24,
    fontWeight: "bold",
  },

  arrow: {
    color: "#D7FF2F",
    fontSize: 34,
    fontWeight: "bold",
  },

  sectionContent: {
    marginTop: 22,
    paddingHorizontal: 4,
  },

  checkRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  checkText: {
    color: "#fff",
    fontSize: 20,
    flex: 1,
    paddingRight: 12,
  },

  buttonGroup: {
    flexDirection: "row",
    gap: 12,
  },

  checkButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#D7FF2F",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  checkButtonActive: {
    backgroundColor: "#D7FF2F",
    shadowColor: "#D7FF2F",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },

  tick: {
    color: "#000",
    fontSize: 24,
    fontWeight: "bold",
  },

  xButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ff4444",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  xButtonActive: {
    backgroundColor: "#ff4444",
  },

  xText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "bold",
  },

  photoButton: {
    backgroundColor: "#1748d1",
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: "center",
    marginBottom: 18,
  },

  photoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  photoPreview: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    marginBottom: 16,
  },

  notes: {
    backgroundColor: "#050505",
    color: "#fff",
    fontSize: 18,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },

  submitButton: {
    backgroundColor: "#D7FF2F",
    marginTop: 24,
    marginHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#D7FF2F",
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 14,
  },

  submitText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "bold",
  },
  disabledButton: {
    opacity: 0.6,
  },

  disabledControl: {
    opacity: 0.5,
  },
});