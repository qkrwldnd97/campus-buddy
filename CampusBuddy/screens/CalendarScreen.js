import React, { Component, createRef } from "react";
import { readString } from "react-native-csv";
import {
  StyleSheet,
  Button,
  View,
  Text,
  ScrollView,
  FlatList,
  Alert,
  Linking,
  Dimensions,
  TouchableOpacity,
  Modal,
  Animated,
  TextInput,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState, useContext } from "react";
import DropDownPicker from "react-native-dropdown-picker";
import { ColorWheel } from "../components/ui/ColorWheel";
import { Colors } from "../constants/colors";
import * as DocumentPicker from "expo-document-picker";
import Icon from "react-native-vector-icons/FontAwesome";
import Octicons from "react-native-vector-icons/Octicons";
import { genTimeBlock } from "react-native-timetable";
import { addSchedule, addEvent, to_request } from "../firebaseConfig";
import { auth, db, userSchedule, getUserEvents } from "../firebaseConfig";
import EventItem from "../components/ui/EventItem";
import { even, IconButton } from "@react-native-material/core";
import TopHeaderDays from "../components/ui/TopHeaderDays";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ThemeContext from "../components/ui/ThemeContext";
import theme from "../components/ui/theme";
import { EventCategory } from "../constants/eventCategory";
import { CalendarViewType } from "../constants/calendarViewType";
import HolidaySettingModal from "../components/ui/HolidaySettingModal";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView, useSafeAreaFrame } from "react-native-safe-area-context";
import MonthViewItem from "../components/MonthViewItem";
import { MultiSelect } from 'react-native-element-dropdown';
import AntDesign from 'react-native-vector-icons/AntDesign';
import {
  getMonthName,
  getWeekDayName,
  isOnSameDate,
  JSClock,
} from "../helperFunctions/dateFunctions";
import EventViewInRow from "../components/ui/EventViewInRow";

const leftHeaderWidth = 50;
const topHeaderHeight = 60;
const dailyWidth = (Dimensions.get("window").width - leftHeaderWidth) / 3;
const dailyHeight = Dimensions.get("window").height / 10;

export default class App extends Component {
  constructor(props) {
    super(props);
    this.numOfDays = 7;
    this.pivotDate = genTimeBlock("mon");

    this.svRef = React.createRef();

    this.scrollPosition = new Animated.Value(0);
    this.scrollEvent = Animated.event(
      [{ nativeEvent: { contentOffset: { y: this.scrollPosition } } }],
      { useNativeDriver: false }
    );

    this.state = {
      visible: false,
      list: [],
      calendarEventList: [],
      midterms: [],
      holidays: [],
      testlist: [],
      holidayCountryList: [],
      selectedCountryCode: "",
      createEventVisible: false,
      holidaySettingVisible: false,
      title: "",
      location: "",
      colorPicker: false,
      eventColor: "#8b9cb5",
      openList: false,
      value: null,
      repetitionItems: [
        { label: "Never", value: 0 },
        { label: "Daily", value: 1 },
        { label: "Weekly", value: 2 },
        { label: "Monthly", value: 3 },
      ],
      openDate: false,
      repetition: 0,
      eventStartDate: new Date(),
      eventStartTime: new Date(),
      eventEndDate: new Date(),
      eventEndTime: new Date(),
      points: 0,
      // This is the starting date for the current calendar UI.
      weekViewStartDate: new Date(),
      currentDate: new Date(), // This is the selected date
      monthViewData: [],
      calendarView: CalendarViewType.WEEK, //On click, go above a level. Once date is clicked, go into week view.
    };
  }

  async componentDidMount() {
    //Set the calendar UI start date
    let tempDate = new Date();
    tempDate.setDate(tempDate.getDate() - tempDate.getDay());
    this.setState({ weekViewStartDate: tempDate });

    //Set month view calendar UI with the start date and store in monthViewData
    this.createMonthViewData(tempDate);
    // Getting schedules from database
    const res = await userSchedule(auth.currentUser?.uid);
    const result = [];
    const eventResult = [];
    if (res != null) {
      res["things"].map((element) => {
        const sp = element.data.split(",");
        const temp = {
          category: EventCategory.SCHOOLCOURSE,
          title: sp[3],
          startTime: new Date(sp[2]),
          endTime: new Date(sp[0]),
          location: sp[1],
        };
        result.push(temp);
      });
    }

    this.setState({ list: result });

    // Getting events from database
    const events = await getUserEvents(auth.currentUser?.uid);
    if (events != null) {
      for (let i = 0; i < events["event"].length; i++) {
        const temp = {
          category: EventCategory.EVENT,
          title: events["event"][i]["title"],
          startTime: new Date(events["event"][i]["startTime"].seconds * 1000), //multiply 1000 since Javascript uses milliseconds. Timestamp to date.
          endTime: new Date(events["event"][i]["endTime"].seconds * 1000),
          location: events["event"][i]["location"],
          color: events["event"][i]["color"],
        };
        eventResult.push(temp);
      }
    }

    this.checkList(eventResult); //Checks for events that go over multiple days and corrects it

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        if (
          doc.data().holidayNationPref !== null &&
          doc.data().holidayNationPref !== ""
        ) {
          let cPref = doc.data().holidayNationPref;

          this.setState({ selectedCountryCode: cPref });
          this.getHolidays(cPref, this.state.weekViewStartDate.getFullYear());
        }
      }
    });
    const friends = doc(db, "friend_list", auth.currentUser?.email)
    onSnapshot(friends, (doc) => {
      this.setState({
        friend_list: [...doc.data()["favorite"], ...doc.data()["friends"]],
        searched: [...doc.data()["favorite"], ...doc.data()["friends"]]
      })
    })
    console.log(this.state.friend_list)
  }

  //Format event list so it works with the calendar view.
  checkList = (result) => {
    result.forEach((event, index) => {
      //For events that go over on day
      if (event.startTime.getDate() != event.endTime.getDate()) {
        // console.log(event);

        let longEvent = event;
        result.splice(index, 1);

        let nEventEndSide = {
          category: longEvent.category,
          color: longEvent.color,
          endTime: longEvent.endTime,
          location: longEvent.location,
          startTime: new Date(
            longEvent.endTime.getFullYear(),
            longEvent.endTime.getMonth(),
            longEvent.endTime.getDate()
          ),
          title: longEvent.title,
        };
        result.splice(index, 0, nEventEndSide);

        let eD = new Date(
          longEvent.endTime.getFullYear(),
          longEvent.endTime.getMonth(),
          longEvent.endTime.getDate()
        );
        eD.setDate(eD.getDate() - 1);
        while (eD.getDate() > longEvent.startTime.getDate()) {
          let middleFullDay = {
            category: longEvent.category,
            color: longEvent.color,
            endTime: new Date(
              eD.getFullYear(),
              eD.getMonth(),
              eD.getDate(),
              23,
              59,
              59
            ),
            location: longEvent.location,
            startTime: new Date(eD.getFullYear(), eD.getMonth(), eD.getDate()),
            title: longEvent.title,
          };
          result.splice(index, 0, middleFullDay);
          eD.setDate(eD.getDate() - 1);
        }

        let endOfDay = new Date(
          longEvent.startTime.getFullYear(),
          longEvent.startTime.getMonth(),
          longEvent.startTime.getDate(),
          23,
          59,
          59
        );
        let nEventStartSide = {
          category: longEvent.category,
          color: longEvent.color,
          endTime: endOfDay,
          location: longEvent.location,
          startTime: longEvent.startTime,
          title: longEvent.title,
        };
        result.splice(index, 0, nEventStartSide);
      }
    });

    this.setState({ calendarEventList: result });
    this.applyEventDataToMonthViewData();
  };

  applyEventDataToMonthViewData = (monthData = this.state.monthViewData) => {
    let eventList = this.state.calendarEventList;
    let currDate = this.state.weekViewStartDate;
    this.setState({ monthViewData: [] });
    let temp = [...monthData];

    for (let i = 0; i < eventList.length; i++) {
      let currEvent = eventList[i];

      if (
        currEvent.startTime.getFullYear() == currDate.getFullYear() &&
        currEvent.startTime.getMonth() == currDate.getMonth()
      ) {
        let index = temp.findIndex(
          (obj) => obj.isThisMonth && obj.date == currEvent.startTime.getDate()
        );
        temp[index].hasEvent = true;
      }
    }
    this.setState({ monthViewData: temp });
  };

  submitEvent = (eventColor) => {
    if (
      this.location == undefined ||
      this.title == undefined ||
      this.location == "" ||
      this.title == ""
    ) {
      alert("Enter title and location for the event");
      this.setLocation("");
      this.setTitle("");
    } else {
      var eventSTime = new Date(
        this.state.eventStartDate.getFullYear(),
        this.state.eventStartDate.getMonth(),
        this.state.eventStartDate.getDate(),
        this.state.eventStartTime.getHours(),
        this.state.eventStartTime.getMinutes()
      );

      var eventETime = new Date(
        this.state.eventEndDate.getFullYear(),
        this.state.eventEndDate.getMonth(),
        this.state.eventEndDate.getDate(),
        this.state.eventEndTime.getHours(),
        this.state.eventEndTime.getMinutes()
      );

      if (eventSTime > eventETime) {
        alert("Invalid Time Frame");
        return;
      }

      addEvent(
        auth.currentUser?.uid,
        this.title,
        eventSTime,
        eventETime,
        this.location,
        EventCategory.EVENT,
        this.points,
        eventColor,
        0
      );

      this.state.calendarEventList.push({
        category: EventCategory.EVENT,
        title: this.title,
        startTime: eventSTime,
        endTime: eventETime,
        location: this.location,
        color: eventColor,
      });

      const message = 
        EventCategory.EVENT + ";" + this.title + ";" + eventSTime.toString() + ";" +
        eventETime.toString() + ";" + this.location + ";" + eventColor.toString() + ";" +
        this.points.toString()
      this.state.selected.map((email) => {
        to_request(auth.currentUser?.email, email, "event", message);
      })

      this.setState({selected: []})
      this.setState({ eventStartDate: new Date() });
      this.setState({ eventStartTime: new Date() });
      this.setState({ eventEndDate: new Date() });
      this.setState({ eventEndTime: new Date() });
      this.setLocation("");
      this.setTitle("");
    }
  };
  setTitle = (title) => {
    this.title = title;
  };

  setLocation = (location) => {
    this.location = location;
  };

  setPoints = (points) => {
    this.points = points;
  };
  scrollViewRef = (ref) => {
    this.timetableRef = ref;
  };

  //render method for MutiselectBox on "Add event" panel
  renderDataItem = (item) => {
    return (
        <View style={styles.item2}>
            <Text style={styles.selectedTextStyle}>{item.user}</Text>
            {
              this.state.selected.indexOf(item.user) > -1 ?
              <AntDesign style={styles.icon} color="black" name="check" size={20} />
              :
              <AntDesign style={styles.icon} color="black" name="plus" size={20} />
            }
        </View>
    );
  };

  //search function for Mutiselect Box
  filter_friends = (text) => {
    const updatedData = this.state.friend_list.filter((item) => {
      return item.user.includes(text)
    });
    if(updatedData.length > 0){
      this.setState({searched: updatedData})
    }
  }

  onEventPress = (evt) => {
    Alert.alert("onEventPress", JSON.stringify(evt));
  };

  openCreateEvent = () => {
    this.setState({ visible: false });
    this.setState({ createEventVisible: true });
  };

  updateColor = (color) => {
    this.setState({ eventColor: color });
    this.setState({ colorPicker: false });
  };

  setHolidaySettings = () => {
    this.setState({ visible: false });
    this.getCountries();
    this.setState({ holidaySettingVisible: true });
  };

  setOpen = () => {
    this.setState({
      openList: !this.state.openList,
    });
  };
  setDateOpen = () => {
    this.setState({
      openDate: !this.state.openList,
    });
  };

  setValue = (value) => {
    this.setState({
      repetition: value,
    });
    this.setState({
      openList: false,
    });
  };

  setItems = (items) => {
    this.setState({
      repetitionItems: items,
    });
  };

  setRepetition = (rep) => {
    this.setState({ repetition: rep });
    this.setState({
      openList: false,
    });
  };

  clickHandler = () => {
    this.setState({ visible: true });
  };

  //START Holiday Setting Modal Component Functions
  //fetch public holiday
  getHolidays = async (countryCode, year) => {
    try {
      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
      );
      const resp = await response.json();
      this.setState({ holidays: resp });
    } catch (error) {
      console.error("Error at getHolidays\n" + error);
    }
  };
  getCountries = async () => {
    try {
      const response = await fetch(
        `https://date.nager.at/api/v3/AvailableCountries`
      );
      const resp = await response.json();
      let nList = [];
      for (let i in resp) {
        nList.push({ key: resp[i].countryCode, value: resp[i].name });
      }
      this.setState({ holidayCountryList: nList });
    } catch (error) {
      console.error(error);
    }
  };

  storeData = async (value) => {
    this.setState({ selectedCountryCode: value });
    // this.getHolidays(value, this.state.weekViewStartDate.getFullYear());
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      holidayNationPref: value,
    });
    this.setState({ holidaySettingVisible: false });
  };

  removeData = async () => {
    this.setState({ selectedCountryCode: "" });
    this.setState({ holidays: [] });
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      holidayNationPref: "",
    });
    this.setState({ holidaySettingVisible: false });
  };

  closeHolidaySettingModal = () => {
    this.setState({ holidaySettingVisible: false });
  };

  selectCountryHolidaySettingModal = (country) => {
    this.setState({ selectedCountry: country });
  };

  //END Holiday Setting Modal Component Functions

  openURL = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error("An error occurred", err)
    );
  };

  openDocumentFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({});
    fetch(res.uri)
      .then(async (response) => {
        const resp = await response.text();
        var result = readString(resp, { header: true });
        result.data.forEach((product) => {
          console.log(product["Name"]);
          if (
            (product["Type"] == "Midterm Examination" ||
              product["Type"] == "Final Examination") &&
            product["Published End"] != null
          ) {
            this.state.midterms.push(
              product["Type"] +
                ";" +
                product["Name"] +
                ";" +
                product["First Date"] +
                ";" +
                product["Published Start"] +
                ";" +
                product["Published End"] +
                ";" +
                product["Location"]
            );
          } else if (
            /[0-9]/.test(product["Published Start"]) ||
            product["Published Start"] == "noon"
          ) {
            const st =
              product["Published Start"] == "noon"
                ? 12
                : product["Published Start"].split(":");
            const ed = product["Published End"].split(":");
            var start, start_min, end, end_min;
            if (product["Published Start"].lastIndexOf("a") > -1) {
              start = st[0];
              start_min = st[1].replace("a", "");
            } else if (product["Published Start"].lastIndexOf("p") > -1) {
              st[0] != "12"
                ? (start = parseInt(st[0], 10) + 12)
                : (start = parseInt(st[0], 10));
              start_min = st[1].replace("p", "");
            } else {
              start = st;
              start_min = 0;
            }
            if (product["Published End"].lastIndexOf("a") > -1) {
              end = ed[0];
              end_min = ed[1].replace("a", "");
            } else if (product["Published End"].lastIndexOf("p") > -1) {
              ed[0] != "12"
                ? (end = parseInt(ed[0], 10) + 12)
                : (end = parseInt(ed[0], 10));
              end_min = ed[1].replace("p", "");
            }
            for (var i = 0; i < product["Day Of Week"].length; i++) {
              //Monday
              if (product["Day Of Week"][i] == "M") {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("MON", start, start_min),
                  endTime: genTimeBlock("MON", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
                //Tuesday
              } else if (
                product["Day Of Week"][i] == "T" &&
                product["Day Of Week"].length > i + 1 &&
                product["Day Of Week"][i + 1] != "h"
              ) {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("TUE", start, start_min),
                  endTime: genTimeBlock("TUE", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
                //Wednesday
              } else if (product["Day Of Week"][i] == "W") {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("WED", start, start_min),
                  endTime: genTimeBlock("WED", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
                //Thursday
              } else if (
                product["Day Of Week"][i] == "T" &&
                product["Day Of Week"][i + 1] == "h"
              ) {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("THU", start, start_min),
                  endTime: genTimeBlock("THU", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
                //Friday
              } else if (product["Day Of Week"][i] == "F") {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("FRI", start, start_min),
                  endTime: genTimeBlock("FRI", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
                //Saterday
              } else if (product["Day Of Week"][i] == "S") {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("SAT", start, start_min),
                  endTime: genTimeBlock("SAT", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
                //Sunday
              } else if (product["Day Of Week"][i] == "U") {
                this.state.list.push({
                  title: product["Name"] + " (" + product["Type"] + ")",
                  startTime: genTimeBlock("SUN", start, start_min),
                  endTime: genTimeBlock("SUN", end, end_min),
                  location: product["Location"],
                  color: "#D1FF96",
                });
              }
            }
          }
        });
        const uniqueArray = this.state.list.filter((value, index) => {
          const _value = JSON.stringify(value);
          return (
            index ===
            this.state.list.findIndex((obj) => {
              return JSON.stringify(obj) === _value;
            })
          );
        });
        this.setState({ list: uniqueArray });
        this.setState({ visible: !this.state.visible });
        addSchedule(auth.currentUser?.uid, this.state.list);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  //navigate through calendar ui
  goPrevDay = () => {
    let currYear = this.state.currentDate.getFullYear();

    let tempCurr = this.state.currentDate;
    tempCurr.setDate(tempCurr.getDate() - 1);
    this.setState({ currDate: tempCurr });

    if (tempCurr.getDay() == 6) {
      //If new date is saturday, meaning it's a different week
      let tempDate = this.state.weekViewStartDate;
      tempDate.setDate(tempDate.getDate() - 7);

      if (
        tempDate.getFullYear() != currYear &&
        this.state.selectedCountryCode != null &&
        this.state.selectedCountryCode.length > 0
      ) {
        this.getHolidays(
          this.state.selectedCountryCode,
          tempDate.getFullYear()
        );
      }
      this.setState({ weekViewStartDate: tempDate });
    }
  };

  goNextDay = () => {
    let currYear = this.state.currentDate.getFullYear();

    let tempCurr = this.state.currentDate;
    tempCurr.setDate(tempCurr.getDate() + 1);
    this.setState({ currDate: tempCurr });

    if (tempCurr.getDay() == 0) {
      //If new date is saturday, meaning it's a different week
      let tempDate = this.state.weekViewStartDate;
      tempDate.setDate(tempDate.getDate() + 7);

      if (
        tempDate.getFullYear() != currYear &&
        this.state.selectedCountryCode != null &&
        this.state.selectedCountryCode.length > 0
      ) {
        this.getHolidays(
          this.state.selectedCountryCode,
          tempDate.getFullYear()
        );
      }
      this.setState({ weekViewStartDate: tempDate });
    }
  };

  goPrevWeek = () => {
    let currYear = this.state.weekViewStartDate.getFullYear();

    let tempCurr = this.state.currentDate;
    tempCurr.setDate(tempCurr.getDate() - 7);
    this.setState({ currDate: tempCurr });

    let tempDate = this.state.weekViewStartDate;
    tempDate.setDate(tempDate.getDate() - 7);

    if (
      tempDate.getFullYear() != currYear &&
      this.state.selectedCountryCode != null &&
      this.state.selectedCountryCode.length > 0
    ) {
      this.getHolidays(this.state.selectedCountryCode, tempDate.getFullYear());
    }
    this.setState({ weekViewStartDate: tempDate });
  };
  goNextWeek = () => {
    let currYear = this.state.weekViewStartDate.getFullYear();

    let tempCurr = this.state.currentDate;
    tempCurr.setDate(tempCurr.getDate() + 7);
    this.setState({ currDate: tempCurr });

    let tempDate = this.state.weekViewStartDate;
    tempDate.setDate(tempDate.getDate() + 7);
    if (
      tempDate.getFullYear() != currYear &&
      this.state.selectedCountryCode != null &&
      this.state.selectedCountryCode.length > 0
    ) {
      this.getHolidays(this.state.selectedCountryCode, tempDate.getFullYear());
    }
    this.setState({ weekViewStartDate: tempDate });
  };
  //navigate through calendar ui
  goPrevMonth = () => {
    let currYear = this.state.weekViewStartDate.getFullYear();

    let tempCurr = this.state.currentDate;
    tempCurr.setMonth(tempCurr.getMonth() - 1);
    this.setState({ currDate: tempCurr });

    let tempDate = this.state.weekViewStartDate;
    tempDate.setMonth(tempDate.getMonth() - 1);

    if (
      tempDate.getFullYear() != currYear &&
      this.state.selectedCountryCode != null &&
      this.state.selectedCountryCode.length > 0
    ) {
      this.getHolidays(this.state.selectedCountryCode, tempDate.getFullYear());
    }
    this.setState({ weekViewStartDate: tempDate });
    this.createMonthViewData(tempDate);
  };
  goNextMonth = () => {
    let currYear = this.state.weekViewStartDate.getFullYear();

    let tempCurr = this.state.currentDate;
    tempCurr.setMonth(tempCurr.getMonth() + 1);
    this.setState({ currDate: tempCurr });

    let tempDate = this.state.weekViewStartDate;
    tempDate.setMonth(tempDate.getMonth() + 1);
    if (
      tempDate.getFullYear() != currYear &&
      this.state.selectedCountryCode != null &&
      this.state.selectedCountryCode.length > 0
    ) {
      this.getHolidays(this.state.selectedCountryCode, tempDate.getFullYear());
    }
    this.setState({ weekViewStartDate: tempDate });
    this.createMonthViewData(tempDate);
  };

  goToday = () => {
    this.setState({ currentDate: new Date() });
    let tempDate = new Date();
    tempDate.setDate(tempDate.getDate() - tempDate.getDay());
    if (
      this.state.selectedCountryCode != null &&
      this.state.selectedCountryCode.length > 0
    ) {
      this.getHolidays(this.state.selectedCountryCode, tempDate.getFullYear());
    }
    this.setState({ weekViewStartDate: tempDate });
    this.createMonthViewData(tempDate);
  };

  createMonthViewData = (startDate) => {
    let prevMonthDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      0
    );
    let numDaysInPrevMonth = prevMonthDate.getDate();
    let monthDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0
    );
    let monthData = [];
    let numDaysInMonth = monthDate.getDate();
    monthDate.setDate(1);
    for (let i = 0; i < 42; i++) {
      if (i < monthDate.getDay()) {
        const temp = {
          date: numDaysInPrevMonth - monthDate.getDay() + i + 1,
          hasEvent: false,
          isThisMonth: false,
        };
        // monthData.push(temp);
        monthData = [...monthData, temp];
      } else {
        if (i < monthDate.getDay() + numDaysInMonth) {
          const temp = {
            date: i - monthDate.getDay() + 1,
            hasEvent: false,
            isThisMonth: true,
          };

          // monthData.push(temp);
          monthData = [...monthData, temp];
        } else {
          const temp = {
            date: i - numDaysInMonth - monthDate.getDay() + 1,
            hasEvent: false,
            isThisMonth: false,
          };
          // monthData.push(temp);
          monthData = [...monthData, temp];
        }
      }
    }
    this.applyEventDataToMonthViewData(monthData);
    // this.setState({ monthViewData: monthData });
  };

  onEventStartDateSelected = (event, value) => {
    this.setState({ eventStartDate: value });
  };

  onEventStartTimeSelected = (event, value) => {
    this.setState({ eventStartTime: value });
  };

  onEventEndDateSelected = (event, value) => {
    this.setState({ eventEndDate: value });
  };

  onEventEndTimeSelected = (event, value) => {
    this.setState({ eventEndTime: value });
  };

  sayHi = (e) => {
    console.log("HIIIIIIIIIIIIIIIIIIII");
  };
  scrollViewEventOne = (e) => {
    this.svRef.current.scrollTo({
      x: 0,
      y: e.nativeEvent.contentOffset.y,
      animated: true,
    });
  };

  scrollEvent = Animated.event(
    [{ nativeEvent: { contentOffset: { y: this.scrollPosition } } }],
    { useNativeDriver: false }
  );

  toggleCalendarView = () => {
    // switch (this.state.calendarView) {
    //   case CalendarViewType.WEEK:
    //     this.setState({ calendarView: CalendarViewType.MONTH });
    //     break;
    //   case CalendarViewType.MONTH:
    //     this.setState({ calendarView: CalendarViewType.WEEK });
    //     break;
    //   default:
    //     console.error("Something Wrong with toggle calendar view");
    //     break;
    // }
    switch (this.state.calendarView) {
      case CalendarViewType.DAY:
        this.setState({ calendarView: CalendarViewType.WEEK });
        break;
      case CalendarViewType.WEEK:
        this.setState({ calendarView: CalendarViewType.MONTH });
        break;
      case CalendarViewType.MONTH:
        this.setState({ calendarView: CalendarViewType.DAY });
        break;

      default:
        console.error("Something Wrong with toggle calendar view");
        break;
    }
  };

  render() {
    const {
      title,
      location,
      openList,
      repetitionItems,
      colorPicker,
      eventColor,
      weekViewStartDate: weekViewStartDate,
      repetition,
      openDate,
    } = this.state;
    if (colorPicker) {
      console.log("colorpicked");
      return <ColorWheel updateColor={this.updateColor} />;
    }
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={this.clickHandler}
          style={styles.touchableOpacityStyle}
        >
          <Icon name="plus-circle" size={50} />
        </TouchableOpacity>

        <Modal
          animationType="slide"
          transparent={true}
          visible={this.state.visible}
          onRequestClose={() => {
            this.setState({ visible: !this.state.visible });
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View style={styles.modalView}>
              {/* Modal for calendar options */}
              <Button
                title="Download schedule"
                onPress={() =>
                  this.openURL(
                    "https://timetable.mypurdue.purdue.edu/Timetabling/gwt.jsp?page=personal"
                  )
                }
              />
              <Button
                title="Import schedule"
                onPress={() => this.openDocumentFile()}
              />
              <Button title="Add event" onPress={this.openCreateEvent} />
              <Button
                title="Holiday settings"
                onPress={this.setHolidaySettings}
              />
              <Button
                title="Close modal"
                onPress={() => {
                  this.setState({ visible: !this.state.visible });
                }}
              />
            </View>
          </View>
        </Modal>
        {/* Create event modal */}
        <Modal
          animationType="slide"
          visible={this.state.createEventVisible}
          transparent={true}
          onRequestClose={() => {
            this.setState({ visible: !this.state.createEventVisible });
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View style={styles.modal}>
              <TouchableOpacity
                onPress={() => this.setState({ createEventVisible: false })}
              >
                <View style={{ paddingLeft: 270, paddingTop: 5 }}>
                  <Icon name="times" size={20} color="#2F4858" />
                </View>
              </TouchableOpacity>
              {/* Creating a new View component with styles.row for each row in the modal for formatting */}
              <View style={styles.row}>
                <Text style={styles.header_text}>Create Event</Text>
              </View>
              <View style={styles.row}>
                {/* New row for color picker and title input */}
                <TouchableOpacity
                  onPress={() => this.setState({ colorPicker: true })}
                >
                  <View style={{ paddingTop: 5, paddingRight: 15 }}>
                    <Icon name="square" size={40} color={eventColor} />
                  </View>
                </TouchableOpacity>
                <TextInput
                  style={styles.titleInputStyle}
                  placeholder="Add title"
                  placeholderTextColor="#8b9cb5"
                  onChangeText={(text) => this.setTitle(text)}
                ></TextInput>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, paddingTop: 10 }}>
                  <Icon name="map-pin" size={20} color="#2F4858" />
                </View>
                <View style={{ flex: 8 }}>
                  <TextInput
                    style={styles.inputStyle}
                    placeholder="Location"
                    placeholderTextColor="#8b9cb5"
                    onChangeText={(text) => this.setLocation(text)}
                  ></TextInput>
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, paddingTop: 10 }}>
                  <Icon name="repeat" size={20} color="#2F4858" />
                </View>
                <View style={{ flex: 8 }}>
                  {/*dropdown selection does not work :(*/}
                  <DropDownPicker
                    open={openList}
                    value={repetition}
                    items={repetitionItems}
                    placeholder={"Never"}
                    setValue={this.setValue}
                    setItems={this.setItems}
                    onPress={this.setOpen}
                  />
                </View>
              </View>
              {/* <View style={styles.row}> */}
              <View style={styles.row}>
                <Text
                  style={{
                    textAlign: "center",
                    margin: 5,
                    paddingTop: 10,
                    paddingLeft: 80,
                    color: "#2F4858",
                  }}
                >
                  Points
                </Text>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <TextInput
                    placeholderTextColor="#8b9cb5"
                    style={{
                      color: "black",
                      borderWidth: 1,
                      borderColor: "#8b9cb5",
                      marginLeft: 10,
                      marginTop: 5,
                      width: 50,
                      height: 30,
                      textAlign: "center",
                    }}
                    value={this.state.points}
                    defaultValue={0}
                    keyboardType="numeric"
                    onChangeText={(text) => this.setPoints(text)}
                  ></TextInput>
                </ScrollView>
              </View>
              <View style={styles.row}>
                <Text
                  style={{
                    textAlign: "center",
                    margin: 5,
                    paddingTop: 7,
                    color: "#2F4858",
                  }}
                >
                  Start
                </Text>
                <DateTimePicker
                  mode={"date"}
                  value={this.state.eventStartDate}
                  onChange={this.onEventStartDateSelected}
                  style={{ marginLeft: 10, marginTop: 5 }}
                />
                <DateTimePicker
                  mode={"time"}
                  value={this.state.eventStartTime}
                  onChange={this.onEventStartTimeSelected}
                  style={{ marginLeft: 10, marginTop: 5 }}
                />
              </View>
              <View style={styles.row}>
                <Text
                  style={{
                    textAlign: "center",
                    margin: 5,
                    paddingTop: 7,
                    color: "#2F4858",
                  }}
                >
                  End
                </Text>
                <DateTimePicker
                  mode={"date"}
                  value={this.state.eventEndDate}
                  onChange={this.onEventEndDateSelected}
                  style={{ marginLeft: 10, marginTop: 5 }}
                />
                <DateTimePicker
                  mode={"time"}
                  value={this.state.eventEndTime}
                  onChange={this.onEventEndTimeSelected}
                  style={{ marginLeft: 10, marginTop: 5 }}
                />
              </View>
              <View style={{width: '70%', margin: 10}}>
                <MultiSelect
                    style={styles.dropdown}
                    placeholderStyle={styles.placeholderStyle}
                    selectedTextStyle={styles.selectedTextStyle}
                    inputSearchStyle={styles.inputSearchStyle}
                    iconStyle={styles.iconStyle}
                    data={this.state.searched}
                    valueField="user"
                    placeholder="Choose friends"
                    value={this.state.selected}
                    search
                    searchQuery={(text) => {
                      this.filter_friends(text)
                      }
                    }
                    searchPlaceholder="Search..."
                    onChange={item => {
                        this.setState({selected: item})
                    }}
                    renderItem={this.renderDataItem}
                    renderSelectedItem={(item, unSelect) => (
                        <TouchableOpacity onPress={() => unSelect && unSelect(item)}>
                            <View style={styles.selectedStyle}>
                                <Text style={styles.textSelectedStyle}>{item.user}</Text>
                                <AntDesign color="black" name="delete" size={17} />
                            </View>
                        </TouchableOpacity>
                    )}
                  />
              </View>
              <Button
                title="Create new event"
                onPress={() => {
                  this.submitEvent(eventColor),
                    this.setState({ createEventVisible: false });
                }}
              />
            </View>
          </View>
        </Modal>

        <HolidaySettingModal
          holidaySettingVisible={this.state.holidaySettingVisible}
          holidayCountryList={this.state.holidayCountryList}
          selectedCountryCode={this.state.selectedCountryCode}
          selectedCountry={this.state.selectedCountry}
          closeHolidaySettingModal={this.closeHolidaySettingModal}
          selectCountryHolidaySettingModal={
            this.selectCountryHolidaySettingModal
          }
          storeData={this.storeData}
          removeData={this.removeData}
        />

        {/* Bottom tab bar hides calendar screen. TODO Need to fix this.*/}
        <View style={{ flex: 1, marginBottom: 15 }}>
          {/* Info Above the calendar times */}
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                  alignItems: "flex-start",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 20 }}>
                  {this.state.calendarView == CalendarViewType.WEEK ||
                  this.state.calendarView == CalendarViewType.MONTH
                    ? getMonthName(this.state.weekViewStartDate.getMonth())
                    : getMonthName(this.state.currentDate.getMonth())}
                </Text>
                <Text style={{ fontSize: 12 }}>
                  {this.state.weekViewStartDate.getFullYear()}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                <IconButton
                  style={{}}
                  color={Colors.grey}
                  onPress={() => {
                    switch (this.state.calendarView) {
                      case CalendarViewType.DAY:
                        return this.goPrevDay();
                      case CalendarViewType.WEEK:
                        return this.goPrevWeek();
                      case CalendarViewType.MONTH:
                        return this.goPrevMonth();
                      default:
                        return null;
                    }
                  }}
                  icon={(props) => <Octicons name="triangle-left" {...props} />}
                />
                <Pressable
                  style={{ padding: 10 }}
                  onPress={() => this.goToday()}
                >
                  <Text style={{ fontSize: 15 }}>Today</Text>
                </Pressable>

                <IconButton
                  style={{}}
                  color={Colors.grey}
                  onPress={() => {
                    switch (this.state.calendarView) {
                      case CalendarViewType.DAY:
                        return this.goNextDay();
                      case CalendarViewType.WEEK:
                        return this.goNextWeek();
                      case CalendarViewType.MONTH:
                        return this.goNextMonth();
                      default:
                        return null;
                    }
                  }}
                  icon={(props) => (
                    <Octicons name="triangle-right" {...props} />
                  )}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: "flex-end",
                }}
              >
                <Pressable
                  style={{
                    alignItems: "center",
                    padding: 10,
                  }}
                  onPress={this.toggleCalendarView}
                >
                  <Text
                    style={{
                      fontSize: 15,
                    }}
                  >
                    {this.state.calendarView}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {(() => {
            switch (this.state.calendarView) {
              case CalendarViewType.WEEK:
                return (
                  <View style={{ flexDirection: "row", height: "100%" }}>
                    <View>
                      <View style={{ height: topHeaderHeight }} />
                      <ScrollView scrollEnabled={false} ref={this.svRef}>
                        {Array.from(Array(24).keys()).map((index) => (
                          <View
                            // key={`TIME${name}-${index}`}
                            key={index}
                            style={{
                              height: dailyHeight,
                              // justifyContent: "center",
                              flexDirection: "row",
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  index <= 12 && index > 0
                                    ? Colors.morningTimeColor
                                    : Colors.eveningTimeColor,
                                width: 20,
                                marginHorizontal: 4,
                                textAlign: "center",
                              }}
                            >
                              {index}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                    <ScrollView
                      style={{
                        height: "100%",
                        width: "100%",
                      }}
                      horizontal={true}
                    >
                      <View style={{ flexDirection: "column" }}>
                        <TopHeaderDays
                          holidays={this.state.holidays}
                          startDay={this.state.weekViewStartDate}
                        />

                        <ScrollView
                          style={{
                            backgroundColor: "#F8F8F8",
                            width: "100%",
                            height: "100%",
                          }}
                          horizontal={false}
                          nestedScrollEnabled
                          scrollEventThrottle={16}
                          onScroll={this.scrollViewEventOne}
                        >
                          <View
                            style={{
                              height: dailyHeight * 24,
                            }}
                          >
                            {this.state.list.map((event) => {
                              return makeVisible(
                                this.state.weekViewStartDate,
                                event
                              ) ? (
                                <EventItem
                                  key={`EITEM-${1}-${event.title}-${
                                    event.startTime
                                  }`}
                                  navigation={this.props.navigation}
                                  category={event.category}
                                  day={event.startTime.getDay()}
                                  startTime={new Date(event.startTime)}
                                  endTime={new Date(event.endTime)}
                                  title={event.title}
                                  location={event.location}
                                  color={event.color}
                                />
                              ) : (
                                <View />
                              );
                            })}
                            {this.state.calendarEventList.map((event) => {
                              return makeVisible(
                                this.state.weekViewStartDate,
                                event
                              ) ? (
                                <EventItem
                                  key={`EITEM-${1}-${event.title}-${
                                    event.startTime
                                  }`}
                                  navigation={this.props.navigation}
                                  category={event.category}
                                  day={event.startTime.getDay()}
                                  startTime={new Date(event.startTime)}
                                  endTime={new Date(event.endTime)}
                                  title={event.title}
                                  location={event.location}
                                  color={event.color}
                                />
                              ) : (
                                <View />
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    </ScrollView>
                  </View>
                );
              case CalendarViewType.MONTH:
                return (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text style={styles.monthViewHeaderDayText}>Sun</Text>
                      <Text style={styles.monthViewHeaderDayText}>Mon</Text>
                      <Text style={styles.monthViewHeaderDayText}>Tues</Text>
                      <Text style={styles.monthViewHeaderDayText}>Wed</Text>
                      <Text style={styles.monthViewHeaderDayText}>Thur</Text>
                      <Text style={styles.monthViewHeaderDayText}>Fri</Text>
                      <Text style={styles.monthViewHeaderDayText}>Sat</Text>
                    </View>
                    <FlatList
                      scrollEnabled={false}
                      data={this.state.monthViewData}
                      renderItem={({ item }) => (
                        // console.log(item)
                        <MonthViewItem
                          date={item.date}
                          hasEvent={item.hasEvent}
                          isThisMonth={item.isThisMonth}
                        />
                      )}
                      //Setting the number of column
                      numColumns={7}
                      keyExtractor={(item, index) => index}
                    />
                  </View>
                );
              case CalendarViewType.DAY:
                return (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      // backgroundColor: "teal",
                    }}
                  >
                    <View
                      style={{
                        // backgroundColor: "red",
                        flexDirection: "row",
                        borderBottomWidth: 2,
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "column",
                          alignItems: "center",
                          padding: 6,
                        }}
                      >
                        <Text style={{ fontSize: 40 }}>
                          {this.state.currentDate.getDate()}
                        </Text>
                        <Text>
                          {getWeekDayName(this.state.currentDate.getDay())}
                        </Text>
                      </View>
                    </View>
                    {/* If event is on the date selected, show the event. */}
                    {this.state.calendarEventList.map((event) => {
                      if (
                        isOnSameDate(event.startTime, this.state.currentDate)
                      ) {
                        console.log(event);
                        return (
                          <EventViewInRow
                            title={event.title}
                            location={event.location}
                            startTime={JSClock(event.startTime)}
                            endTime={JSClock(event.endTime)}
                          />
                        );
                      }
                    })}
                  </View>
                );
              default:
                return (
                  <View>
                    <Text>Something went wrong...!</Text>
                  </View>
                );
            }
          })()}
        </View>
      </SafeAreaView>
    );
  }
}

class ScrollViewVerticallySynced extends React.Component {
  componentDidMount() {
    this.listener = this.props.scrollPosition.addListener((position) => {
      this.instance.scrollTo({
        y: position.value,
        animated: false,
      });
    });
  }

  render() {
    const { name, style, onScroll, eventList, weekStartDate } = this.props;
    return (
      <ScrollView
        key={name}
        ref={(ref) => (this.instance = ref)}
        style={style}
        scrollEventThrottle={1}
        onScroll={onScroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {populateRows(name, eventList, weekStartDate)}
      </ScrollView>
    );
  }
}

const makeVisible = (weekStartDate, event) => {
  //if event is school course, make visible
  if (event.category == EventCategory.SCHOOLCOURSE) {
    return true;
  }
  //week range start and end
  let s = weekStartDate;
  let e = new Date(weekStartDate);
  e.setDate(e.getDate() + 6);

  //if event is within the week time frame, make visible
  if (event.startTime >= s && event.startTime <= e) {
    return true;
  }
  return false;
};

// If name is Time, populate the hours 0 ~ 24.
// TODO: Need to set which time the time's going to start.
// If name is Days, populate the schedule.
const populateRows = (name, eventList, weekStartDate) =>
  name == "Time"
    ? Array.from(Array(24).keys()).map((index) => (
        <View
          key={`TIME${name}-${index}`}
          style={{
            height: dailyHeight,
            flex: 1,
            alignItems: "center",
            // justifyContent: "center",
          }}
        >
          <Text
            style={{
              color:
                index <= 12 && index > 0
                  ? Colors.morningTimeColor
                  : Colors.eveningTimeColor,
            }}
          >
            {index}
          </Text>
        </View>
      ))
    : Array.from(Array(24).keys()).map((index) => (
        <View
          key={`NT${name}-${index}`}
          style={{
            height: dailyHeight,
            flex: 1,
            flexDirection: "row",
          }}
        >
          {eventList.map((event) => {
            return index == event.startTime.getHours() &&
              makeVisible(weekStartDate, event) ? (
              <EventItem
                key={`EITEM${name}-${index}-${event.title}-${event.startTime}`}
                category={event.category}
                day={event.startTime.getDay()}
                startTime={new Date(event.startTime)}
                endTime={new Date(event.endTime)}
                title={event.title}
                location={event.location}
                color={event.color}
              />
            ) : (
              <View />
            );
          })}
          {this.state.calendarEventList.map((event) => {
            return index == event.startTime.getHours() &&
              makeVisible(this.state.weekViewStartDate, event) ? (
              <EventItem
                key={`EITEM-${index}-${event.title}-${event.startTime}`}
                category={event.category}
                day={event.startTime.getDay()}
                startTime={new Date(event.startTime)}
                endTime={new Date(event.endTime)}
                title={event.title}
                location={event.location}
                color={event.color}
              />
            ) : (
              <View />
            );
          })}
        </View>
      ));

const styles = StyleSheet.create({
  headerStyle: {
    backgroundColor: "#81E1B8",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
    alignItems: "center",
    justifyContent: "center",
  },
  daysWithDate: {
    width: dailyWidth,
    flexDirection: "column",
    alignItems: "center",
  },
  days: {
    textAlign: "center",
    fontSize: 16,
  },
  date: {
    fontSize: 12,
  },
  monthViewHeaderDayText: {
    width: Dimensions.get("window").width / 7,
    textAlign: "center",
    fontSize: 16,
  },
  touchableOpacityStyle: {
    position: "absolute",
    width: 50,
    height: 50,
    right: 30,
    bottom: 30,
    zIndex: 1,
  },
  modalView: {
    position: "absolute",
    width: 200,
    right: 90,
    bottom: 165,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    //여기
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 25,
    marginRight: 25,
  },
  modal: {
    backgroundColor: "white",
    width: 350,
    height: 585,
    justifyContent: "center",
    alignItems: "center",
  },
  header_text: {
    color: "white",
    flex: 1,
    backgroundColor: "#2F4858",
    fontSize: 20,
    textAlign: "center",
  },
  inputStyle: {
    flex: 1,
    color: "black",
    paddingLeft: 10,
    borderWidth: 1,
    borderColor: "#8b9cb5",
  },
  titleInputStyle: {
    flex: 1,
    color: "black",
    height: 50,
    paddingLeft: 10,
    borderWidth: 1,
    fontSize: 18,
    borderColor: "#8b9cb5",
  },
  dropdown: {
    height: 50,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
        width: 0,
        height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,

    elevation: 2,
  },
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
      fontSize: 14,
  },
  iconStyle: {
      width: 20,
      height: 20,
  },
  inputSearchStyle: {
      height: 40,
      fontSize: 16,
  },
  selectedStyle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'white',
    shadowColor: '#000',
    marginTop: 8,
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowOffset: {
        width: 0,
        height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,

    elevation: 2,
  },
  textSelectedStyle: {
      marginRight: 5,
      fontSize: 16,
  },
  item2: {
    padding: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
