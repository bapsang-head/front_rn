import React, {useState, useLayoutEffect, useRef, useEffect} from 'react';
import {View, Text, TextInput, Button, StyleSheet, TouchableOpacity} from 'react-native';
import { NavigationContainer, useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon, MaterialCommunityIcons } from '@expo/vector-icons';

import {styles} from '../styles/styles';

import FixingInputAloneComponent from '@components/FixingInput_Alone'
import LoadingComponent from '@components/LoadingComponent'
import SaveCompleteComponent from '@components/SaveCompleteComponent'

import customAxios from '../apis/customAxios' //커스텀 axios

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseISO, format } from 'date-fns';

//foodData는 이전 컴포넌트에서 아래와 같은 type의 배열 형태로 넘어올 것이다.
type simpleFoodData = {
  name: string;
  unit: string;
  count: number;
}

//simpleFoodData 객체들의 배열 타입 정의
type simpleFoodDataArray = simpleFoodData[];

//StackNavigator의 ParamList 타입을 정한다
//TypeScript에서 발생하는 route.params 객체에 eatingTime, markedDate, serverResponse가 없을 수도 있다고 예상할 수 있음
type RootStackParamList = {
  FixTextInputScreen: {
    eatingTime: string;
    markedDate: string;
    simplifiedData: simpleFoodDataArray
  }
}

//두번째 분석을 위해 서버에 POST 요청으로 보낼 requestBody를 만드는 function
function makeRequestBody(eatingTime: string, 
  formattedDate: string, 
  analysisResult: any) {

  let mealType: string = null;
  //mealType 변수를 상황에 맞추어 설정한다
  if(eatingTime === '아침 식사') {
    mealType = "BREAKFAST";
  } else if(eatingTime === '점심 식사') {
    mealType = "LUNCH";
  } else if(eatingTime === '저녁 식사') {
    mealType = "DINNER";
  }

  //Key값 변경을 해주어야 한다!
  const transformedResult = analysisResult.map(item => ({
    quantity: item.count, // "count"를 "quantity"로 변경
    food: item.name,      // "name"을 "food"로 변경
    unit: item.unit       // "unit"은 그대로 유지
  }));

  let secondAnalysisRequestBody = {
    "mealType": mealType,
    "date": formattedDate,
    "data": transformedResult
  }

  return secondAnalysisRequestBody;
}

//name(음식) 정보와 Unit(단위) 정보만을 객체로 추출하는 함수
function extractFoodAndUnit(analysisResult: {name: string, unit: string, count: number}[])
{
  return analysisResult.map(item => ({
    name: item.name,
    unit: item.unit
  }));
}

//추후의 식단 수정 화면
function FixTextInputScreen(){
  const nav = useNavigation(); //네비게이션 사용을 위해 useNavigation() 가져오기
  const abortControllerRef = useRef(null); // AbortController를 useRef로 관리


  //route.paramas를 사용해서 navigation 사이에서 파라미터를 받을 것이다 (route 객체의 타입을 명시적으로 정의한다)
  const route = useRoute<RouteProp<RootStackParamList, 'FixTextInputScreen'>>();
  const { eatingTime, markedDate, simplifiedData } = route.params; //넘겨받은 파라미터를 access 한다

  // console.log('mainScreenSection으로부터 넘겨받은 정보: ', simplifiedData);

  let [completeBtnAvailable, setCompleteBtnAvailable] = useState(false); //'완료' 버튼을 누를 수 있는 상황인지 확인
  let [subComponentPageNum, setSubComponentPageNum] = useState(0); //화면 하단에 표시되는 Component 페이지 번호 관련 state

  //서버로부터 분석한 결과를 저장하는 state (추후 연동할 것임)
  let [analysisResult, setAnalysisResult] = useState(simplifiedData);

  //사용자가 1차 분석 후 수정을 완료하고 '완료' 버튼을 눌렀는지 여부를 확인하는 state
  let [isFixingCompleted, setIsFixingCompleted] = useState(false);

  //2차 식단 정보 분석 후 분석 결과 화면에 바로 보여주기 위해 state 하나를 선언한다
  let [mealInfoDetail, setMealInfoDetail] = useState(null);

  //사용자가 입력한 입력에 관하여 2차 분석 (재시도 요청에 사용될 변수 retryCount)
  async function userInputAnalysis_inFixInput(retryCount = 0, controller) {
    console.log('사용자가 최종적으로 수정한 것: ', analysisResult);

    const parsedDate = parseISO(markedDate);
    const formattedDate = format(parsedDate, 'yyyy-MM-dd');  // 원하는 형식으로 변환

    const accessToken = await AsyncStorage.getItem('accessToken'); // AsyncStorage에서 accessToken 가져오기

    let mealType: string = null;
    //mealType 변수를 상황에 맞추어 설정한다
    if(eatingTime === '아침 식사') {
      mealType = "BREAKFAST";
    } else if(eatingTime === '점심 식사') {
      mealType = "LUNCH";
    } else if(eatingTime === '저녁 식사') {
      mealType = "DINNER";
    }

    //1. 우선 식단 내역 초기화부터 해야 한다 (delete 요청 날려야 한다)
    const delete_url = `/api/v1/foods/records/date/${formattedDate}/type/${mealType}`;
    try {
      if (accessToken) {
        const response = await customAxios.delete(delete_url, {
          headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Authorization': `Bearer ${accessToken}`,
          },
          timeout: 5000,
          signal: controller.signal,
        });

        console.log('Delete 요청 성공: ',response.data);
      }

    } catch (error) {
      //네트워크 오류가 발생한 경우에도 재시도를 해야 한다
      if (error.message === 'Network Error') { 
        console.warn('네트워크 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
        // 네트워크 오류 발생 시 재시도
        if (retryCount < 5) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_inFixInput(retryCount + 1, controller));
            }, 1000); // 1초 후에 재시도
          });
        } else {
          console.error('네트워크 오류로 인해 재시도 횟수를 초과했습니다.');
        }
      
      //요청이 5초 이상 걸리는 경우에도 재시도를 해야 한다
      } else if (error.code === 'ECONNABORTED') {
        console.warn('5초가 지났습니다. 재시도 중...', retryCount + 1);
        if (retryCount < 8) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_inFixInput(retryCount + 1, controller));
            }, 1000);
          });
        } else {
          console.error('재시도 횟수를 초과했습니다.');
        }
      } else {
        console.error('음식 정보 삭제 중 에러 발생: ', error);
      }
      return; // POST 요청 중 에러 발생 시 함수 종료
    }

    //2. 음식 정보를 업로드해야 한다(POST)
    //업로드 관련 request body를 만들어 낸다
    let requestBody = makeRequestBody(eatingTime, formattedDate, analysisResult);
    console.log('만든 request body의 date: ', requestBody.date);
    console.log('만든 request body의 mealType: ', requestBody.mealType);

    const url = `/api/v1/foods/information`;

    // 음식 정보를 업로드 하는 부분 (POST)
    try {
      if (accessToken) {
        const response = await customAxios.post(url, requestBody, {
          headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Authorization': `Bearer ${accessToken}`,
          },
          timeout: 5000,
          signal: controller.signal,
        });

        if (response.status === 200) { //성공적으로 식단 정보를 업로드 했을 경우
          console.log('사용자 식단 정보를 성공적으로 저장했습니다!');
        } else {
          console.log('응답이 성공적이지 않습니다: ', response.status);
        }
      }

    } catch (error) {
      //네트워크 오류가 발생한 경우에도 재시도를 해야 한다
      if (error.message === 'Network Error') { 
        console.warn('네트워크 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
        // 네트워크 오류 발생 시 재시도
        if (retryCount < 5) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_inFixInput(retryCount + 1, controller));
            }, 1000); // 1초 후에 재시도
          });
        } else {
          console.error('네트워크 오류로 인해 재시도 횟수를 초과했습니다.');
        }
      
      //요청이 5초 이상 걸리는 경우에도 재시도를 해야 한다
      } else if (error.code === 'ECONNABORTED') {
        console.warn('5초가 지났습니다. 재시도 중...', retryCount + 1);
        if (retryCount < 8) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_inFixInput(retryCount + 1, controller));
            }, 1000);
          });
        } else {
          console.error('재시도 횟수를 초과했습니다.');
        }
      } else {
        console.error('음식 정보 업로드 중 에러 발생: ', error);
      }
      return; // POST 요청 중 에러 발생 시 함수 종료
    }

    // 음식 정보를 조회하는 부분 (GET)
    try {
      console.log('식단 영양 정보를 불러오는 중입니다');
      const foodAndUnitArray = extractFoodAndUnit(analysisResult); // 배열 생성

      const promises = foodAndUnitArray.map(({ name, unit }) => {
        return customAxios
          .get(url, {
            params: {
              food: name,
              unit: unit,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            timeout: 5000,
            signal: controller.signal,
          })
          .then((response) => {
            console.log('응답 받음(그람수 응답): ', response.data.gram);
            return response.data;
          })
          .catch((error) => {
            console.error('에러 발생:', error.message);
            return null;
          });
      });

      const results = await Promise.all(promises);
      setMealInfoDetail(results); //state에 서버로부터 불러온 식단 세부 정보 저장
      console.log('모든 요청 완료, 세부 식단 정보를 출력하겠습니다:', mealInfoDetail);
      
      setCompleteBtnAvailable(true);
      setSubComponentPageNum((prevNum) => prevNum + 1);
      

    } catch (error) {
      //네트워크 오류가 발생한 경우에도 재시도를 해야 한다
      if (error.message === 'Network Error') { 
        console.warn('네트워크 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
        // 네트워크 오류 발생 시 재시도
        if (retryCount < 5) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_inFixInput(retryCount + 1, controller));
            }, 1000); // 1초 후에 재시도
          });
        } else {
          console.error('네트워크 오류로 인해 재시도 횟수를 초과했습니다.');
        }

      //요청이 5초 이상 걸리는 경우에도 재시도를 해야 한다
      } else if (error.code === 'ECONNABORTED') {
        console.warn('5초가 지났습니다. 재시도 중...', retryCount + 1);
        if (retryCount < 8) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_inFixInput(retryCount + 1, controller));
            }, 1000);
          });
        } else {
          console.error('재시도 횟수를 초과했습니다.');
        }
      } else {
        console.error('음식 정보 조회 중 에러 발생: ', error);
      }
    }
  }

  const updateStates = (direction: String) => {
    //'완료' 버튼을 누른 경우
    if(direction === 'forward') {
      setCompleteBtnAvailable(false); //'완료' 버튼은 다시 누를 수 없는 상태가 되어야 한다
      setSubComponentPageNum(prevPageNum => prevPageNum + 1); //subComponentPage 번호를 +1 해준다
    //'뒤로가기' 버튼을 누른 경우
    } else if(direction === 'backward') {
      //각 상황에 맞게 state를 업데이트 해주어야 한다
      if(subComponentPageNum === 1) { //영양성분 분석/저장중일 때..
        setIsFixingCompleted(false);  //두번째 분석 중에 빽도하는 경우엔 '완료' 버튼 signal을 다시 false로 바꿔주어야 한다.
        setSubComponentPageNum(prevPageNum => prevPageNum - 1); //subComponentPage 번호를 -2 해준다
      }
    }
  }

  const renderSubComponent = () => {
    switch(subComponentPageNum) {
      case 0:
        return <FixingInputAloneComponent
                analysisResult={analysisResult}
                setAnalysisResult={setAnalysisResult}
                completeBtnAvailable={completeBtnAvailable} //'완료' 버튼 활성/비활성화 상태값 추적을 위해
                setCompleteBtnAvailable={setCompleteBtnAvailable}
                isFixingCompleted={isFixingCompleted}
                />;
      case 1:
        return <LoadingComponent comment="수정한 식단으로 저장중입니다" 
          userInputAnalysis_inFixInput={userInputAnalysis_inFixInput}
          abortControllerRef={abortControllerRef}/>;
      case 2:
        return <SaveCompleteComponent setCompleteBtnAvailable={setCompleteBtnAvailable} mealInfoDetail={mealInfoDetail}/>
    } 
  }

  //완료 버튼을 눌렀을 때의 동작 수행
  const handleDonePress = () => {
    //'완료' 버튼을 눌렀을 경우에만 axios 요청을 실시한다
    abortControllerRef.current = new AbortController(); //새로운 AbortController 생성

    //0페이지에서 완료 버튼을 눌렀을 경우엔
    if(subComponentPageNum === 0)
    {
      // subComponentPageNum이 0인 경우에는 analysisResult가 업데이트된 후 페이지를 넘어가게 해야 함
      setIsFixingCompleted(true); //'완료' 버튼을 눌렀다는 signal을 true로 바꾼다
    } else if(subComponentPageNum === 2){ // 식단 저장이 완료 되었다는 페이지(마지막 컴포넌트)에서 '완료' 버튼을 누를 경우
      //Stack을 초기화한다
      nav.dispatch(
        CommonActions.reset({
          index: 0, //Navigation Stack에 'MainScreen'만 남도록 설정 
          routes: [
            {name: 'TabNavigator'}
          ]
        })
      );
    } else {
      // subComponentPageNum이 2가 아닌 경우는 그냥 바로 다음 subComponent 페이지로 이동하도록 설계
      updateStates('forward'); 
    }
  }

  //subComponentPageNum이 0인 경우에는.. '완료' 버튼을 누른 후 다음 단계로 넘어가는 부분을 useEffect로 처리해야 한다
  useEffect(() => {
    //subComponentPageNum이 0이고, isFixingCompleted 값이 true인 경우
    if(subComponentPageNum === 0 && isFixingCompleted) {
      //analysisResult가 변경되고, 유효한 경우(analysisResult가 빈 배열이 아닌 경우)에만 다음 단계로 넘어감
      if(analysisResult && analysisResult.length > 0) {
        updateStates('forward'); //다음 페이지로 이동
        setIsFixingCompleted(false); //'완료' 상태 초기화
      }
    }
  }, [isFixingCompleted, analysisResult, subComponentPageNum]); 

  //useLayoutEffect()를 통해서 header 설정을 TextInputScreen 내부에서 수행한다
  useLayoutEffect(() => {
      nav.setOptions({
        title: '입력',
        headerTitle: () => <></>,
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerShadowVisible: false,
        headerBackVisible: false,
        headerLeft: () => (
          //수정이 완료된 마지막 페이지에선 뒤로가기 버튼을 없애본다
          subComponentPageNum === 2 ? (
              null
          ) : (
              <TouchableOpacity onPress={() => {
                  if(subComponentPageNum === 0) //subComponent의 맨 첫페이지인 경우
                  {
                    nav.goBack();
                  } else { //그렇지 않은 경우
                    if(abortControllerRef.current) { //axios 요청을 abort 하는 controller가 존재하는 경우(null이 아닌 경우)
                      abortControllerRef.current.abort(); //뒤로 가기 시 요청 취소
                    }
                    updateStates('backward');
                  }
                }}>
                  <MaterialCommunityIcons name="chevron-left" size={32} />
                </TouchableOpacity>
          )
        ),
        headerRight: () => (
          <>
          {
            completeBtnAvailable ? (
              //완료 버튼을 누를 수 있는 상태인 경우
              <TouchableOpacity onPress={handleDonePress}>
                <Text style={{fontSize: 20, color: 'green', fontWeight: 'bold'}}>완료</Text>
              </TouchableOpacity>
            ) : (
              //완료 버튼을 누를 수 없는 상태인 경우
              <Text style={{fontSize: 20, color: 'gray', fontWeight: 'light'}}>완료</Text>
            )
          }
          </>
        ),
      });
    }, [nav, handleDonePress]);

  

  return (
      <View style={{marginHorizontal: 28}}>
          {/* 제목 쪽 UI */}
          <View style={styles.header}>
              <Text style={styles.titleTextStyleInInputScreen}>식단을 수정해 주세요</Text>
          </View>
          {
            //subComponent는 아래의 함수에서 조건에 맞게 수행될 것이다
            renderSubComponent()
          }
      </View>
  );
}

export default FixTextInputScreen;