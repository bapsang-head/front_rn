//Libarary or styles import
import React, { useState, useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Button, SafeAreaView, ScrollView, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
//import { Calendar, CalendarList, LocaleConfig, ExpandableCalendar, CalendarProvider } from 'react-native-calendars';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import moment from 'moment';
import { styles } from '../styles/styles';

//svg import
import MainIcon from '../assets/MainIcon';

//components import
import BottomSheetModal from '@components/BottomSheetModal';

//메인화면 Component
function MainScreen() {

    console.log("MainScreen rendering");


    const bottomSheetRef = useRef<BottomSheet>(null); // Reference for the bottom sheet
    const currentDate = moment().format('YYYY-MM-DD'); //현재 날짜(currentDate)를 YYYY-MM-DD 형식으로 가져온다
  
  
    let [isCalendarVisible, setIsCalendarVisible] = useState(true); //Calendar의 visibility를 관리한다
    let [currentMonth, setCurrentMonth] = useState(new Date().toISOString().split('T')[0]); // 초기값 현재 날짜
    let [selectedDate, setSelectedDate] = useState(currentDate); //선택된 날짜를 관리한다
    let [appIsReady, setAppIsReady] = useState(false) //앱이 준비되었는지 여부를 관리한다
  

    //날짜를 선택했을 때 호출되는 함수 onDayPress를 정의한다
    let onDayPress = (day: { dateString: React.SetStateAction<string>; }) => {
      setSelectedDate(day.dateString);
    }
  
  
    //캘린더를 보여주거나 숨기는 함수 toggleCalendar를 정의한다
    let toggleCalendar = () => {
      setIsCalendarVisible(!isCalendarVisible);
    };
  
    let onVisibleMonthsChange = (months) => {
      //첫 번째 보이는 달의 정보를 가져온다
      const month = months[0].dateString;
      setCurrentMonth(month);
    }
  
    //현재 월과 연도를 추출한다
    let year = new Date(currentMonth).getFullYear();
    let month = new Date(currentMonth).getMonth() + 1;
  
    // Get the week dates for the current date
    const getWeekDates = (date: moment.MomentInput) => {
      const startOfWeek = moment(date).startOf('week');
      return Array.from({ length: 7 }, (_, i) =>
        startOfWeek.clone().add(i, 'day').format('YYYY-MM-DD')
      );
    };
  
    
  
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={styles.monthText}>{year}년 {month}월</Text>
            <Button title={isCalendarVisible ? "달력 접기" : "달력 펼치기"} onPress={toggleCalendar} />
          </View>
  
          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>아침 식사</Text>
            </TouchableOpacity>
            <Text>아직 추가된 식단이 없어요!</Text>
            <Button title="텍스트로 기록하기" onPress={() => {}} />
          </View>
          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>점심 식사</Text>
            </TouchableOpacity>
            <Text>3,982kcal</Text>
            <Text>삼겹살 1근</Text>
            <Text>BBQ 황금올리브 1마리</Text>
            <Text>코카콜라 제로 1캔</Text>
            <Text>멸치쇼핑 땅콩 1줌</Text>
            <Button title="수정하기" onPress={() => {}} />
            <Button title="세부 영양성분" onPress={() => {}} />
          </View>
          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>저녁 식사</Text>
            </TouchableOpacity>
            <Text>1234</Text>
          </View>
        </ScrollView>
        <BottomSheet ref={bottomSheetRef} snapPoints={['9%', '24%']}>
          <View style={styles.bottomSheetContent}>
            <Text>나의 일일 칼로리 섭취 현황 확인하기</Text>
            {/* <Button title="닫기" onPress={() => bottomSheetRef.current?.close()} /> */}
            <BottomSheetModal onClose={false} MyActivity={3250} TodayEatenCalories={200}/>
          </View>
        </BottomSheet>
      </SafeAreaView>
    );
  }

  export default MainScreen;