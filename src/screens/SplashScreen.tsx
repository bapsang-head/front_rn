import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import { format, subMonths, addMonths } from 'date-fns'; //날짜 formatting을 위해 date-fns 함수를 사용할 것임

import customAxios from '../apis/customAxios'; // 커스텀 Axios 가져오기
import {setNavigationRef} from '../apis/customAxios' //navigation 1회에 최초 초기화


//redux-toolkit을 사용하기 위한 import
import { useSelector, useDispatch } from "react-redux"
import { RootState, AppDispatch } from '../store'
import { 
    setHeight, 
    setWeight, 
    setAge, 
    setGender, 
    setActivityLevel, 
    setName, 
    setEmail,
    calculateBMR, 
    calculateActivityMetabolism 
} from "../slices/accountInfoSlice";
import { setMealInput } from '../slices/mealInputSlice';

//'월별 식단 입력 정보 데이터'를 서버로부터 불러와서 redux에 저장하는 함수
async function fetchMealInput(accessToken: any, dispatch: AppDispatch) {

    try {
        let currentMonth = format(new Date(), 'yyyy-MM'); //현재 날짜를 YYYY-MM 형식으로 formatting
        let previousMonth = format(subMonths(new Date(), 1), 'yyyy-MM'); //currentMonth 기준 이전 달 값 가져오기
        let nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM'); //currentMonth 기준 다음 달 값 가져오기

        //요청할 url들을 배열로 묶어서 추후 map 함수를 이용해서 한 번에 처리할 것이다
        const urls = [
            `/api/v1/foods/records/year-month/${previousMonth}`,
            `/api/v1/foods/records/year-month/${currentMonth}`,
            `/api/v1/foods/records/year-month/${nextMonth}`,
        ];

        if(accessToken) {
            //AsyncStorage에 저장되어 있는 accessToken(매개변수로 넘어올 것임)을 이용해서 회원 정보를 불러온다 (3번 요청하므로, map 함수 사용)
            const [prevData, currentData, nextData] = await Promise.all(
                urls.map(url => customAxios.get(url, {
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Authorization': `Bearer ${accessToken}`,
                    }
                }))
            );

            // 받아온 데이터를 redux에 각각 저장
            dispatch(setMealInput({ month: previousMonth, mealData: prevData.data }));
            dispatch(setMealInput({ month: currentMonth, mealData: currentData.data }));
            dispatch(setMealInput({ month: nextMonth, mealData: nextData.data }));
            console.log('bapsanghead:', currentMonth, '기준으로 잘 불러옴!');
        }
    } catch (error) {
        console.error('Meal Input 데이터 불러오는 중 에러 발생: ', error);
    }
}

//유저 정보 서버로부터 불러와서 redux에 저장하는 함수
async function fetchUserProfile(accessToken: any, dispatch: AppDispatch) {

    try {
        const url = `/api/v1/users/profile`; //post 요청에 사용할 url 설정
        if(accessToken) {
            //AsyncStorage에 저장되어 있는 accessToken(매개변수로 넘어올 것임)을 이용해서 회원 정보를 불러온다
            const response = await customAxios.get(url, {
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'Authorization': `Bearer ${accessToken}`, //Authorization 헤더 추가
                },
            })

            console.log('bapsanghead: accessToken은.. ', accessToken);

            //response로 넘어온 정보 redux에 저장
            dispatch(setName(response.data.name));
            dispatch(setEmail(response.data.email));
            dispatch(setAge(response.data.age));
            dispatch(setGender(response.data.gender));
            dispatch(setActivityLevel(response.data.activityLevel));
            dispatch(setWeight(response.data.weight));
            dispatch(setHeight(response.data.height));

            //모든 상태가 설정된 후 기초 대사량 및 활동 대사량 계산 후 저장
            dispatch(calculateBMR());
            dispatch(calculateActivityMetabolism());

        }
    } catch (error) {
        console.error('bapsanghead: get 요청 중 에러 발생: ', error)
    }
}

//accessToken 유효기간 체킹 
//AggregateError가 발생할 수 있으므로, 이를 해결하기 위해 아래와 같이 추가적인 try-catch문이 요구됨
async function checkAccessToken(navigation, dispatch: AppDispatch) {
    try {
        const accessToken = await AsyncStorage.getItem('accessToken');

        if (accessToken) {
            try {
                const decodedAccessToken = jwtDecode(accessToken);
                const currentTime = Date.now() / 1000;

                if (decodedAccessToken.exp < currentTime) {
                    console.log('bapsanghead: AccessToken이 만료되었습니다.');
                    checkRefreshToken(navigation);
                } else {
                    console.log('bapsanghead: AccessToken이 유효합니다. 로그인을 진행합니다.');
                    try {
                        await fetchUserProfile(accessToken, dispatch);
                        await fetchMealInput(accessToken, dispatch);
                        navigation.replace("TabNavigator");
                    } catch (fetchError) {
                        console.error('bapsanghead: 프로필이나 식단 데이터를 가져오는 중 오류 발생:', fetchError);
                    }
                }
            } catch (decodeError) {
                console.error('bapsanghead: AccessToken 디코딩 중 오류 발생:', decodeError);
                navigation.replace("LoginScreen");
            }
        } else {
            console.log('bapsanghead: accessToken이 asyncStorage에 존재하지 않습니다.');
            navigation.replace("LoginScreen");
        }
    } catch (error) {
        console.error('bapsanghead: AccessToken 확인하던 도중에 에러 발생함:', error);
    }
}


//refreshToken을 이용한 체킹 (유효할 시에 이를 이용하여 accessToken 재발급(로그인 수행), 유효하지 않으면 로그인 창으로 이동)
async function checkRefreshToken(navigation) {
    try {
        //백엔드 쪽에서 아직 refreshToken을 이용한 accessToken 재발급 endpoint 제공 X / 우선 재로그인 시도하도록 함
        const refreshToken = await EncryptedStorage.getItem('refreshToken');
        if(refreshToken) {
            const decodedRefreshToken = jwtDecode(refreshToken);
            // const currentTime = Date.now() / 1000;

            // if(decodedRefreshToken.exp < currentTime) {
            //     console.log('Refresh Token이 만료되었습니다.');
            //     navigation.replace("LoginScreen");
            // } else {
            //     console.log('Refresh Token이 유효합니다.');
            // }
        } else {
            console.log('bapsanghead: refreshToken이 encryptedStorage에 존재하지 않습니다.');
        }
        console.log('bapsanghead: 내부에 저장된 RefreshToken: ', refreshToken);
        navigation.replace("LoginScreen");
    } catch (error) {
        console.error('bapsanghead: RefreshToken 확인하던 도중에 에러 발생함: ', error);
    }
}

//SplashScreen (스플래시 화면 관련 컴포넌트)
function SplashScreen() {
    const navigation = useNavigation(); //navigation 기능 사용을 위한 useNavigation() 훅 사용

    //최초 1회 navigation 객체 초기화
    useEffect(()=>{
        setNavigationRef(navigation);
        console.log('네비게이션 객체 최초 1회 초기화됨!');
    }, [])

    //accountInfo를 초기화하기 위한 코드
    const dispatch: AppDispatch = useDispatch();

    async function loadResourcesAndNavigate() {
        try {
            //리소스 로딩 수행
            await new Promise(resolve => setTimeout(resolve, 2000)); //예시로 1초 대기

            //리소스 로딩 완료 후 적절한 화면으로 전환 (토큰 검사)
            checkAccessToken(navigation, dispatch);
        } catch (error) {
            console.error('bapsanghead: 리소스 로드 실패', error);
        }
    }
 
    useEffect(()=>{
        loadResourcesAndNavigate();
    },[navigation]);


    return (
        <View style={styles.container}>
            <Text>Loading...</Text>
            <ActivityIndicator size="large" color="#0000ff" />
        </View>
    )

}

export default SplashScreen;


const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
});