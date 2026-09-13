const API_BASE="";

 

const form=document.getElementById("registerForm");

const state=document.getElementById("registerState");

const ref=document.getElementById("referralCode");

const refStatus=document.getElementById("refStatus");

 

function setState(message){

  if(state) state.textContent=message;

}

 

async function readJson(response){

  const text=await response.text();

 

  try{

    return text?JSON.parse(text):{};

  }catch{

    return {

      ok:false,

      error:"invalid_server_response",

      message:"The server returned an invalid response. Please try again."

    };

  }

}

 

if(ref){

  ref.addEventListener("blur",async()=>{

    const code=ref.value.trim();

 

    if(!code){

      refStatus.textContent="";

      return;

    }

 

    refStatus.textContent="Checking referral code…";

 

    try{

      const response=await fetch(

        API_BASE+"/api/referral/check?code="+encodeURIComponent(code),

        {

          headers:{

            accept:"application/json"

          }

        }

      );

 

      const data=await readJson(response);

 

      if(!response.ok){

        refStatus.textContent=

          data.message||

          "Referral validation is temporarily unavailable.";

        return;

      }

 

      refStatus.textContent=data.valid

        ?"Valid referral code."

        :"Referral code not found.";

 

    }catch{

      refStatus.textContent=

        "Referral validation is temporarily unavailable.";

    }

  });

}

 

if(form){

  form.addEventListener("submit",async event=>{

    event.preventDefault();

 

    if(!form.checkValidity()){

      form.reportValidity();

      return;

    }

 

    setState("Creating account…");

 

    const data=Object.fromEntries(

      new FormData(form).entries()

    );

 

    data.ageConfirmed=form.ageConfirmed.checked;

    data.termsAccepted=form.termsAccepted.checked;

    data.privacyAccepted=form.privacyAccepted.checked;

    data.marketingConsent=form.marketingConsent.checked;

 

    try{

      const response=await fetch(

        API_BASE+"/api/register",

        {

          method:"POST",

          headers:{

            "content-type":"application/json",

            "accept":"application/json"

          },

          body:JSON.stringify(data)

        }

      );

 

      const result=await readJson(response);

 

      if(!response.ok){

        throw new Error(

          result.message||

          (

            result.error==="email_exists"

              ?"An account with this email already exists."

              :

            result.error==="rate_limited"

              ?"Too many registration attempts. Please try again later."

              :

            result.error==="invalid_referral"

              ?"The referral code is not valid."

              :

            result.error==="validation_failed"

              ?"Please complete the required fields and accept the required terms."

              :

            "Account creation failed. Please try again."

          )

        );

      }

 

      const code=result?.user?.referralCode;

 

      setState(

        code

          ?`Account created. Your referral code is ${code}. Email verification is required before activation.`

          :"Account created. Email verification is required before activation."

      );

 

      form.reset();

 

      if(refStatus){

        refStatus.textContent="";

      }

 

    }catch(error){

      setState(

        error?.message||

        "Account creation failed. Please try again."

      );

    }

  });

}
