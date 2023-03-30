// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import firebase from "firebase/compat/app";
import { EmailAuthProvider, credential } from "firebase/auth";
import { query, where } from "firebase/firestore";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  QueryEndAtConstraint,
  updateDoc,
  arrayUnion,
  addDoc,
} from "firebase/firestore";
import uuid from 'react-native-uuid';
import { FieldValue } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDBf2TxclOxjPE5OshjJVCkS6ZCDQ8mIXc",
  authDomain: "campusbuddy-8ef5d.firebaseapp.com",
  projectId: "campusbuddy-8ef5d",
  storageBucket: "campusbuddy-8ef5d.appspot.com",
  messagingSenderId: "968571721255",
  appId: "1:968571721255:web:61445d3dc559a1f4afa002",
  measurementId: "G-TCW4V6Q3P4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore();
export { auth, db };
const dbRef = collection(db, "users");

export async function checkUser(firstName, lastName, userId) {
  console.log(userId);
  return new Promise((resolve, reject) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('id', '==', userId));
    getDocs(q)
      .then((querySnapshot) => {
        let foundUser = null;
        querySnapshot.forEach((doc) => {
          const user = doc.data();
          if (user.first === firstName && user.last === lastName) {
            foundUser = user;
          }
        });
        if (foundUser) {
          alert(`The email address of the user is ${foundUser.email}`);
        } else {
          resolve(null);
          alert('The entered informations are wrong');
        }
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
  });
}

export async function checkEmailExists(email) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

export async function createUser(username, first, last, email, password) {
  const querySnapshot = await getDocs(
    query(collection(db, "users"), where("id", "==", username))
  );
  if (!querySnapshot.empty) {
    throw new Error("Username already exists");
  }
  await createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      console.log("Successfully added new user " + userCredential.user.uid);
      try {
        //add user to db
        setDoc(doc(db, "users", userCredential.user.uid), {
          id: username,
          first: first,
          last: last,
          email: email,
          password: password,
          points: {
            school: 0,
            fitness: 0,
          },
          points_privacy: false,
          calendar_privacy: false,
        });
        //initialize a user in db/requests
        setDoc(doc(db, "requests", userCredential.user.email), {
          from_request: [],
          to_request: [],
        });
        //initialize user friend list
        setDoc(doc(db, "friend_list", userCredential.user.email), {
          friends: [],
          favorite: []
        });
      } catch (e) {
        console.error("Error adding doc: ", e);
      }
    })
    .catch((error) => {
      alert("creating user:" + error);
    });
}

export async function addSchedule(user_token, data) {
  const docRef = doc(db, "schedule", user_token);
  const querySnapShot = await getDoc(docRef);
  if (!querySnapShot.exists()) {
    setDoc(docRef, {
      classes: [],
    });
  }

  try {
    data.map((element) => {
      const x = {
        title: element.title,
        location: element.location,
        startTime: element.startTime,
        endTime: element.endTime
      };
      const data = {
        id: uuid.v4(),
        class: x
      }
      updateDoc(docRef, { 
        classes: arrayUnion(data) 
      });
    });

    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding doc: ", e);
  }
}

export async function userSchedule(user_token) {
  console.log("snap", user_token)
  try {
    const querySnapShot = await getDoc(doc(db, "schedule", user_token));
    if (querySnapShot.exists()) {
      console.log("f1ound schedule", querySnapShot.data())
      const result = querySnapShot.data();
      return result;
    } else {
      return null;
    }
  } catch (error) {
    alert("userSchedule: " + error);
  }
}

export async function addEvent(
  user_token,
  title,
  startTime,
  endTime,
  location,
  category,
  point_value,
  color,
  repetition
) {
  const docRef = doc(db, "events", user_token);
  // const data={
  //   title: title,
  //   startDate: startDate,
  //   startTime: startTime,
  //   endDate: endDate,
  //   endTime: endTime,
  //   location: location,
  //   category: category,
  //   point_value: point_value,
  //   color: color,
  //   repetition: repetition
  // }
  const x = {
    title: title,
    startTime: startTime,
    endTime: endTime,
    location: location,
    category: category,
    point_value: point_value,
    color: color,
    repetition: repetition,
  };
  try {
    const querySnapShot = await getDoc(doc(db, "events", user_token));
    if (!querySnapShot.exists()) {
      setDoc(docRef, {
        event: [],
      });
    }
    const data = {
      id: uuid.v4(),
      details: x
    }
    updateDoc(docRef, { event: arrayUnion(data) });
    console.log("Event doc written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding event: ", e);
  }
}

export async function getUserEvents(user_token) {
  try {
    const querySnapShot = await getDoc(doc(db, "events", user_token));
    if (querySnapShot.exists()) {
      const result = querySnapShot.data();
      return result;
    } else {
      return null;
    }
  } catch (error) {
    alert("Error getting user events: " + error);
  }
}

export async function userList() {
  var result = [];
  try {
    const querySnapShot = await getDocs(collection(db, "users"));
    querySnapShot.forEach((element) => {
      if (auth.currentUser?.email != element.data().email)
        result.push(element.data());
    });
    return result;
  } catch (error) {
    alert("userList: " + error);
  }
}

export async function friendList(user_token) {
  const querySnapShot = await getDoc(doc(db, "friend_list", user_token));
  if (querySnapShot.exists()) {
    const result = querySnapShot.data();
    return result;
  } else {
    const docRef = doc(db, "friend_list", user_token);
    var res = [];
    setDoc(docRef, {
      friends: res,
    });
    return null;
  }
}

export async function getUserId(email) {
  var res = []
  try {
    const querySnapShot = await getDocs(collection(db, "users"));
    querySnapShot.forEach(async (element) => {
      if (element.data().email == email) {
        console.log("id found", element.id)
        res.push(element.id)
       // const schedule = await userSchedule(element.id)
       // console.log("schedule", schedule);

      }
    });
    return res;

  }
  catch(e) {
    console.error("Error getting user's id: ", e);
  }
}

export async function to_request(own, to_user, type, message) {
  const docRef = doc(db, "requests", own);
  const docRef_to = doc(db, "requests", to_user);

  if (type == "friend") {
    try {
      updateDoc(docRef, {
        to_request: arrayUnion(to_user + "/" + type),
      });
      updateDoc(docRef_to, {
        from_request: arrayUnion(own + "/" + type),
      });
      console.log("Successfully sent friend request: ", docRef.id);
    } catch (e) {
      console.error("Error adding doc: ", e);
    }
  }else if(type == "event") {
    try {
      updateDoc(docRef, {
        to_request: arrayUnion(to_user + "/" + message + "/" + type),
      });
      updateDoc(docRef_to, {
        from_request: arrayUnion(own + "/" + message + "/" + type),
      });
      console.log("Successfully sent event request: ", docRef.id);
    } catch (e) {
      console.error("Error adding doc: ", e);
    }
  }
}

export async function addPoints(user_token, category, points) {
  const docRef = doc(db, "users", user_token);
  const querySnapShot = await getDoc(doc(db, "users", user_token));
  const oldPoints = querySnapShot.data().points.school;
  console.log("snapshot", oldPoints)
  try {
    updateDoc(docRef, {
      ['points.' + category]: oldPoints+points
    });
    console.log("Successfully updated points: ", docRef.id);
  } catch (e) {
    console.error("Error updating points: ", e);
  }
}