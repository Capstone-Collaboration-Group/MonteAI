import {useState} from "react";


export default function useOTP(){

const [otp,setOtp]=useState([
"",
"",
"",
"",
"",
]);



const updateOTP=(index:number,value:string)=>{

const copy=[...otp];

copy[index]=value;

setOtp(copy);

}



const verifyOTP=()=>{

return otp.join("").length===6;

}



return{
otp,
updateOTP,
verifyOTP
}


}