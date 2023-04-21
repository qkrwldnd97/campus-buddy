import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  Alert,
  TouchableOpacity,
  Pressable,
} from "react-native";
import {
  addGroup,
  addMembersToGroup,
  addNicknameInGroup,
  auth,
  db,
  removeMemberFromGroup,
} from "../firebaseConfig";
import { FloatingAction } from "react-native-floating-action";
import {
  updateDoc,
  doc,
  arrayRemove,
  onSnapshot,
  arrayUnion,
  getDoc,
  query,
  collection,
  where,
} from "firebase/firestore";


export default function GroupScreen({ navigation, route }) {

  const [groups, setGroups] = useState('');
  const [groupName, setGroupName] = useState('');

  const handleAddGroup = () => {
    if (groupName.trim() === '') {
      return;
    }

    const newGroup = {
      groupName: groupName.trim(),
      mamberList: [],
    };

    database().ref(`groups/${newGroup.id}`).set(newGroup);

    setGroups([...groups, newGroup]);
    setGroupName('');
  };

  const renderItem = ({ item }) => (
    <View style={styles.group}>
      <Text style={styles.groupName}>{item.name}</Text>
    </View>
  );

  useEffect(() => {
    const groupsRef = database().ref('groups');
  
    groupsRef.on('value', (snapshot) => {
      const groupsData = snapshot.val();
      if (groupsData) {
        const groupsList = Object.keys(groupsData).map((groupId) => {
          return {
            id: groupId,
            name: groupsData[groupId].name,
            memberList: groupsData[groupId].memberList,
          };
        });
  
        setGroups(groupsList);
      }
    });
  
    return () => groupsRef.off();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups to Follow</Text>

      <FlatList
        data={groups}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
      />

      <View style={styles.addGroup}>
        <TextInput
          placeholder="Enter group name"
          style={styles.groupNameInput}
          value={groupName}
          onChangeText={(text) => setGroupName(text)}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddGroup}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  group: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  groupName: {
    fontSize: 18,
  },
  addGroup: {
    flexDirection: 'row',
    marginTop: 20,
  },
  groupNameInput: {
    flex: 1,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: 'blue',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});