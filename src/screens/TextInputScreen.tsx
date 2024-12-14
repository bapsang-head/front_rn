import React, {useState, useLayoutEffect, useRef, useEffect} from 'react';
import {View, Text, TextInput, Button, StyleSheet, TouchableOpacity} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon, MaterialCommunityIcons } from '@expo/vector-icons';

import {styles} from '../styles/styles';

import FixingInputComponent from '@components/FixingInput'
import LoadingComponent from '@components/LoadingComponent'
import SaveCompleteComponent from '@components/SaveCompleteComponent'

import customAxios from "../apis/customAxios" //커스텀 Axios 호출

import axios from 'axios';

import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

import { parseISO, format } from 'date-fns';

import { setMealInput } from '../slices/mealInputSlice';

//redux-toolkit을 사용하기 위한 import
import { useDispatch } from "react-redux"
import { RootState, AppDispatch } from '../store'

//StackNavigator의 ParamList 타입을 정의한다
//TypeScript에서 발생하는 route.params 객체에 eatingTime과 markedDate가 없을 수도 있다고 예상할 수 있음.
//따라서 아래와 같이 형식을 명시해 주어야 함
type RootStackParamList = {
  TextInputScreen: {
    eatingTime: string;
    markedDate: string;
  }
}

//두번째 분석을 위해 서버에 보낼 requestBody를 만드는 function
function makeSecondRequestBody(eatingTime: string, 
  markedDate: string, 
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

  const parsedDate = parseISO(markedDate);
  const formattedDate = format(parsedDate, 'yyyy-MM-dd');  // 원하는 형식으로 변환

  let secondAnalysisRequestBody = {
    "mealType": mealType,
    "date": formattedDate,
    "data": analysisResult
  }

  return secondAnalysisRequestBody;
}

//Food(음식) 정보와 Unit(단위) 정보만을 객체로 추출하는 함수
function extractFoodAndUnit(analysisResult: {food: string, unit: string, quantity: number}[])
{
  return analysisResult.map(item => ({
    food: item.food,
    unit: item.unit
  }));
}


//'드신 음식을 입력해 주세요' 화면 (실질적으로 프로젝트의 기술 집약 파트)
function TextInputScreen(){
  const nav = useNavigation(); //네비게이션 사용을 위해 useNavigation() 가져오기
  const abortControllerRef = useRef(null); // AbortController를 useRef로 관리

  //route.paramas를 사용해서 navigation 사이에서 파라미터를 받을 것이다 (route 객체의 타입을 명시적으로 정의한다)
  const route = useRoute<RouteProp<RootStackParamList, 'TextInputScreen'>>();
  const { eatingTime, markedDate } = route.params; //넘겨받은 파라미터를 access 한다

  //accountInfo를 초기화하기 위한 코드
  const dispatch: AppDispatch = useDispatch();

  let [inputText, setInputText] = useState('');
  let [inputTextAvailable, setInputTextAvailable] = useState(true) //상단의 문장 입력하는 칸에다가 텍스트를 입력할 수 있는 상태 handling
  let [completeBtnAvailable, setCompleteBtnAvailable] = useState(false); //'완료' 버튼을 누를 수 있는 상황인지 확인
  let [subComponentPageNum, setSubComponentPageNum] = useState(0); //화면 하단에 표시되는 Component 페이지 번호 관련 state

  //서버로부터 분석한 결과를 저장하는 state
  let [analysisResult, setAnalysisResult] = useState([]);

  //사용자가 1차 분석 후 수정을 완료하고 '완료' 버튼을 눌렀는지 여부를 확인하는 state
  let [isFixingCompleted, setIsFixingCompleted] = useState(false);

  //2차 식단 정보 분석 후 분석 결과 화면에 바로 보여주기 위해 state 하나를 선언한다
  let [mealInfoDetail, setMealInfoDetail] = useState(null);

  const updateStates = (direction: String) => {
    //'완료' 버튼을 누른 경우
    if(direction === 'forward') {
      if(subComponentPageNum === 0) //subComponentPage가 0일 때 '완료' 버튼을 눌렀다면
      {
        setInputTextAvailable(false); //상단의 문장 입력하는 칸에다가 텍스트를 입력할 수 있는 상태 handling
      }
      setCompleteBtnAvailable(false); //'완료' 버튼은 다시 누를 수 없는 상태가 되어야 한다
      setSubComponentPageNum(prevPageNum => prevPageNum + 1); //subComponentPage 번호를 +1 해준다
    //'뒤로가기' 버튼을 누른 경우
    } else if(direction === 'backward') {
      //각 상황에 맞게 state를 업데이트 해주어야 한다
      if(subComponentPageNum === 2 || subComponentPageNum === 1) {
        setInputTextAvailable(true); //첫번째 분석 구간에서 빽도했을 경우엔 텍스트 입력하는 곳을 활성화 해주어야 한다'
      }

      if(subComponentPageNum === 3)
      {
        setIsFixingCompleted(false);  //두번째 분석 중에 빽도하는 경우엔 '완료' 버튼 signal을 다시 false로 바꿔주어야 한다.
      }
      //subComponentPageNum을 2로 나누었을 때 나머지가 0(2 또는 4)이면 2를 빼주고, 1(1 또는 3)이면 1을 빼준다
      setSubComponentPageNum(prevPageNum => prevPageNum - ((subComponentPageNum % 2 === 0) ? 2 : 1));

    }
  }

  //숫자에 따라 컴포넌트를 렌더링 하는 것을 컨트롤하는 renderSubComponent
  //case1, case3(axios 요청을 통해 서버와 통신을 하는 경우)에는 뒤로 가기 버튼을 눌렀을 때 요청 취소를 해야 함. abortControllerRef 또한 넘겨줘야 함
  const renderSubComponent = () => {
    switch(subComponentPageNum) {
      case 0:
        return null;
      case 1:
        return <LoadingComponent comment="입력내용 분석중입니다" 
                userInputAnalysis_First={userInputAnalysis_First}
                abortControllerRef={abortControllerRef}/>;
      case 2:
        return (
          <View style={{marginTop: 24}}>
            <Text style={{fontSize: 20, fontWeight: 'ultralight'}}>입력내용 분석 결과입니다</Text>
            <FixingInputComponent 
              analysisResult={analysisResult} 
              setAnalysisResult={setAnalysisResult}
              completeBtnAvailable={completeBtnAvailable} //'완료' 버튼 활성/비활성화 상태값 추적을 위해
              setCompleteBtnAvailable={setCompleteBtnAvailable}
              isFixingCompleted={isFixingCompleted}
              />
          </View>
        );
      case 3:
        return <LoadingComponent comment="영양성분 분석/저장중입니다" 
                userInputAnalysis_Second={userInputAnalysis_Second}
                abortControllerRef={abortControllerRef}/>;
      case 4:
        return <SaveCompleteComponent setCompleteBtnAvailable={setCompleteBtnAvailable} mealInfoDetail={mealInfoDetail}/>
    } 
  }

  //Input 값에 따라서 완료 버튼 누를 수 있는 상태 handling하는 함수
  const handleInputChange = (text) => {
    setInputText(text);
    //Text가 비어 있지 않으면 completeBtnAvailable을 true로 설정, 비어 있으면 false
    setCompleteBtnAvailable(text.trim().length > 0);
  }

  //사용자가 입력한 문장 1차 분석 (재시도 요청에 사용될 변수 retryCount)
  async function userInputAnalysis_First(retryCount = 0, controller) {
    console.log('사용자가 입력한 문장: ', inputText);

    try {
      const accessToken = await AsyncStorage.getItem('accessToken'); //AsyncStorage에 있는 accessToken 가져온다 (이게 만료되면 추후 RefreshToken으로 accessToken 재발급 필요할 수도)
      const url = `/api/v1/foods/input` //post 요청에 사용할 url
      
      //request body에 포함될 데이터 정의
      const data = {
        user_input: inputText
      };

      if(accessToken) {
        //AsyncStorage에 저장되어 있는 accessToken을 이용해서 식단 문장 1차 분석을 실시할 것임
        const response = await customAxios.post(url, data, {
          headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Authorization': `Bearer ${accessToken}`, //Authorization 헤더 추가
          },
          timeout: 30000, //30초 후 요청이 응답하지 않으면 Timeout
          signal: controller.signal, //AbortController의 signal 전달
        })

        // 서버 응답에서 data 배열 추출
        const extractedData = response.data.data;
        setAnalysisResult(extractedData);
        console.log('서버 응답에서의 extractedData: ', extractedData);

        // 다음 단계로 넘어가도록 페이지 번호를 업데이트
        setSubComponentPageNum(prevNum => prevNum + 1);
      }

    } catch(error) {
      if (error.message === 'Network Error') { //네트워크 오류가 발생한 경우에도 재시도를 해야 한다
        console.warn('네트워크 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
        // 네트워크 오류 발생 시 재시도
        if (retryCount < 6) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_First(retryCount + 1, controller));
            }, 2000); // 2초 후에 재시도
          });
        } else {
          console.error('네트워크 오류로 인해 재시도 횟수를 초과했습니다.');
        }
      //error code가 timeout과 관련한 경우이면..
      } else if(error.code === 'ECONNABORTED') {
        console.warn('30초가 지났습니다. 재시도 중...', retryCount + 1);

        //재시도 횟수를 제한할 수 있다. 여기서는 우선 6번으로 제한함
        if(retryCount < 6) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_First(retryCount + 1, controller));
            }, 1000); //1초 후에 재시도 (재귀적으로 userInputAnalysis() 함수 수행)
          })
        } else {
          console.error('재시도 횟수를 초과했습니다.');
        }
      } else {
        console.error('post 요청 중 에러 발생: ', error);
      }
    }
  }

  //사용자가 입력한 입력에 관하여 2차 분석 (재시도 요청에 사용될 변수 retryCount)
  async function userInputAnalysis_Second(retryCount = 0, controller) {
    
    console.log('사용자가 최종적으로 수정한 것: ', analysisResult);

    //request body를 만들어 낸다
    let requestBody = makeSecondRequestBody(eatingTime, markedDate, analysisResult);
    console.log('만든 request body의 date: ', requestBody.date);
    console.log('만든 request body의 mealType: ', requestBody.mealType);

    const accessToken = await AsyncStorage.getItem('accessToken'); // AsyncStorage에서 accessToken 가져오기
    const url = `/api/v1/foods/information`;

    // 음식 정보를 업로드 하는 부분 (POST)
    try {
      if (accessToken) {
        const response = await customAxios.post(url, requestBody, {
          headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Authorization': `Bearer ${accessToken}`,
          },
          timeout: 30000,
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
              resolve(userInputAnalysis_Second(retryCount + 1, controller));
            }, 1000); // 1초 후에 재시도
          });
        } else {
          console.error('네트워크 오류로 인해 재시도 횟수를 초과했습니다.');
        }
      
      //요청이 30초 이상 걸리는 경우에도 재시도를 해야 한다 (없애기)
      } else {
        console.error('음식 정보 업로드 중 에러 발생: ', error);
      }
      return; // POST 요청 중 에러 발생 시 함수 종료
    }

    // 음식 정보를 조회하는 부분 (GET)
    try {
      console.log('식단 영양 정보를 불러오는 중입니다');
      const foodAndUnitArray = extractFoodAndUnit(analysisResult); // 배열 생성

      const promises = foodAndUnitArray.map(({ food, unit }) => {
        return customAxios
          .get(url, {
            params: {
              food: food,
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
      if (error.message === 'Network Error') { 
        console.warn('네트워크 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
        // 네트워크 오류 발생 시 재시도
        if (retryCount < 5) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(userInputAnalysis_Second(retryCount + 1, controller));
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
              resolve(userInputAnalysis_Second(retryCount + 1, controller));
            }, 1000);
          });
        } else {
          console.error('재시도 횟수를 초과했습니다.');
        }
      } else {
        console.error('음식 정보 조회 중 에러 발생: ', error);
      }
    }

    //음식 입력 현황이 변했으므로, 마지막 과정에서 서버로부터 입력 현황 정보를 다시 받아와서 redux 저장소의 해당 정보를 업데이트 해야 한다
    try {
      let markedMonth = format(new Date(markedDate), 'yyyy-MM'); //기준 날짜를 YYYY-MM 형식으로 formatting

      //markedMonth를 url에 집어넣어 추후 axios를 활용하여 get 요청을 날릴 것이다
      const url = `/api/v1/foods/records/year-month/${markedMonth}`

      if(accessToken) {
          //AsyncStorage에 저장되어 있는 accessToken(매개변수로 넘어올 것임)을 이용해서 axios에 월별 입력 현황을 update 한다
          const response = await customAxios.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${accessToken}`,
            },
            timeout: 5000,
            signal: controller.signal,
          });

          // 받아온 데이터를 redux에 각각 저장 (setMealInput 상태변경 함수는 직접 import했음에도 불구하고, dispatch를 통해 직접 변경해야 한다)
          dispatch(setMealInput({ month: markedMonth, mealData: response.data }));
          console.log("받아온 정보: ", response.data)
          console.log(markedMonth, '기준으로 잘 불러옴!');
      }
    } catch (error) {
      console.error('Meal Input 데이터 불러오는 중 기타 에러 발생: ', error);
    }
  }

  //'완료' 버튼을 눌렀을 때의 동작 수행
  const handleDonePress = () => {
    //'완료' 버튼을 눌렀을 경우에만 axios 요청을 실시한다
    abortControllerRef.current = new AbortController(); //새로운 AbortController 생성

    //2페이지(사용자 1차 수정 페이지)에서 완료 버튼을 눌렀을 경우엔
    if(subComponentPageNum === 2)
    {
      // subComponentPageNum이 2인 경우에는 analysisResult가 업데이트된 후 페이지를 넘어가게 해야 함
      setIsFixingCompleted(true); //'완료' 버튼을 눌렀다는 signal을 true로 바꾼다
    } else if(subComponentPageNum === 4){ // 식단 저장이 완료 되었다는 페이지(마지막 컴포넌트)에서 '완료' 버튼을 누를 경우
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

  //subComponentPageNum이 2인 경우에는.. '완료' 버튼을 누른 후 다음 단계로 넘어가는 부분을 useEffect로 처리해야 한다
  useEffect(() => {
    //subComponentPageNum이 2이고, isFixingCompleted 값이 true인 경우
    if(subComponentPageNum === 2 && isFixingCompleted) {
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
          //수정이 완료된 마지막 페이지(4페이지)에선 뒤로가기 버튼을 없애본다
          subComponentPageNum === 4 ? (
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
              <Text style={styles.titleTextStyleInInputScreen}>드신 음식을 입력해주세요</Text>
          </View>
          <View>
              <TextInput
                  style={[styles.textInputStyle, {marginTop: 24, width: '100%'}]}
                  onChangeText={handleInputChange}
                  value={inputText}
                  placeholder="예시) 삼겹살 2근, 콜라 1캔 먹었어."
                  placeholderTextColor={'#a8a8a8'}
                  editable={inputTextAvailable}
                  multiline={false}
                  textBreakStrategy="simple"/>
          </View>
          {
            //subComponent는 아래의 함수에서 조건에 맞게 수행될 것이다
            renderSubComponent()
          }
      </View>

  );
}

export default TextInputScreen;