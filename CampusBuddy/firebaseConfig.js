// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

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
  measurementId: "G-TCW4V6Q3P4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
export {auth};

const db = getFirestore();
export {db};

export async function createUser(username, first, last, email, password) {
  try {
    const docRef = await addDoc(collection(db, "users"), {
      id: username,
      first: first,
      last: last,
      email: email,
      password: password,
      points: 0
    });
    console.log("Document written with ID: ", docRef.id)
  } catch (e) {
    console.error("Error adding doc: ", e);
  }
  
}

export async function authUser(username, password){
  try{
    const querySnapshot = await getDocs(collection(db, "users"));
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${doc.data()}`);
      if(doc.data()['id'] == username){
        if(doc.data()['password'] == password){
          return doc.data()['id'];
        }
      }
    });
    return null;
  } catch(e){
    console.error(e)
  }
}