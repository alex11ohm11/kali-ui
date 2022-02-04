import React, { useContext, useState } from "react";
import Router from "next/router";
import AppContext from "../../context/AppContext";
import {
  Flex,
  VStack,
  Button,
  Text,
  Select,
  List,
  ListItem,
  Stack,
  HStack,
  Spacer,
  Checkbox,
  Link
} from "@chakra-ui/react";
import { supportedChains } from "../../constants/supportedChains";
import {
  getNetworkName,
  convertVotingPeriod,
  fromDecimals,
} from "../../utils/formatters";
import { addresses } from "../../constants/addresses";
import { factoryInstance } from "../../eth/factory";
import { presets } from "../../constants/presets";
import DashedDivider from "../elements/DashedDivider";
import KaliButton from "../elements/KaliButton";
import ContactForm from "../elements/ContactForm";

export default function Checkout({ details }) {
  const value = useContext(AppContext);
  const { web3, chainId, loading, account } = value.state;
  const [disclaimers, setDisclaimers] = useState([false, false]);
  const [deployable, setDeployable] = useState(false);

  const handleDisclaimer = (num) => {
        console.log(num)
    let disclaimers_ = disclaimers;
    disclaimers_[num] = !disclaimers_[num];
    setDisclaimers(disclaimers_);
    var deployable_ = true;
    for(let i=0; i < disclaimers_.length; i++) {
      if(disclaimers_[i] == false) {
        deployable_ = false;
      }
    }
    setDeployable(deployable_);
  }

  // for use at the end
  let paused;
  if (details["governance"]["paused"] == 1) {
    paused = "restricted";
  } else {
    paused = "unrestricted";
  }

  let daoType;
  if (details["daoType"] == null) {
    daoType = "Custom";
  } else {
    daoType = presets[details["daoType"]]["type"];
  }

  let docs;
  if (details["legal"]["docs"] == "") {
    docs = "Ricardian";
  } else {
    docs = details["legal"]["docs"];
  }

  const deploy = async () => {
    if (!web3 || web3 == null) {
      value.toast(errorMessages["connect"]);
      return;
    }

    value.setLoading(true);

    let factory;
    try {
      factory = factoryInstance(addresses[chainId]["factory"], web3);
    } catch (e) {
      value.toast(e);
    }

    const { daoName, symbol } = details["identity"];

    const { votingPeriod, paused, quorum, supermajority } =
      details["governance"];

    const { docs } = details["legal"];

    const { members, shares } = details["founders"];
    const { network, daoType } = details;
    const { tribute, redemption, crowdsale } = details["extensions"];
    console.log("tribute", tribute);

    const govSettings = Array(
      votingPeriod,
      0,
      quorum,
      supermajority,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1
    );

    let extensionsArray = new Array();
    let extensionsData = new Array();

    if (tribute["active"]) {
      extensionsArray.push(addresses[chainId]["extensions"]["tribute"]);
      extensionsData.push("0x");
    }

    if (crowdsale["active"]) {
      extensionsArray.push(addresses[chainId]["extensions"]["crowdsale"]);

      var {
        listId,
        purchaseToken,
        purchaseMultiplier,
        purchaseLimit,
        saleEnds,
      } = crowdsale;
      console.log(
        "crowdsale param",
        listId,
        purchaseToken,
        purchaseMultiplier,
        purchaseLimit,
        saleEnds
      );

      // let now = parseInt(new Date().getTime() / 1000);
      saleEnds = parseInt(new Date(saleEnds).getTime() / 1000);

      console.log("saleEnds", saleEnds);
      const sale = require("../../abi/KaliDAOcrowdsale.json");

      const saleAddress = addresses[chainId]["extensions"]["crowdsale"];

      const saleContract = new web3.eth.Contract(sale, saleAddress);

      const encodedParams = web3.eth.abi.encodeParameters(
        ["uint256", "address", "uint8", "uint96", "uint32"],
        [listId, purchaseToken, purchaseMultiplier, purchaseLimit, saleEnds]
      );

      let payload = saleContract.methods
        .setExtension(encodedParams)
        .encodeABI();

      extensionsData.push(payload);
    }

    if (redemption["active"]) {
      extensionsArray.push(addresses[chainId]["extensions"]["redemption"]);
      console.log(redemption);
      let { redemptionStart, tokenArray } = redemption;

      // let now = parseInt(new Date().getTime() / 1000);
      redemptionStart = parseInt(new Date(redemptionStart).getTime() / 1000);
      console.log("redemption param", redemptionStart, tokenArray);

      const redemptionABI = require("../../abi/KaliDAOredemption.json");

      const redemptionAddress = addresses[chainId]["extensions"]["redemption"];

      const redemptionContract = new web3.eth.Contract(
        redemptionABI,
        redemptionAddress
      );

      const encodedParams = web3.eth.abi.encodeParameters(
        ["address[]", "uint256"],
        [tokenArray, redemptionStart]
      );

      let payload = redemptionContract.methods
        .setExtension(encodedParams)
        .encodeABI();

      extensionsData.push(payload);
    }

    console.log("extensionsArray", extensionsArray);
    console.log("extensionsData", extensionsData);

    console.log(
      "deployment param",
      daoName,
      symbol,
      docs,
      paused,
      extensionsArray,
      extensionsData,
      members,
      shares,
      govSettings
    );

    try {
      let result = await factory.methods
        .deployKaliDAO(
          daoName,
          symbol,
          docs,
          paused,
          extensionsArray,
          extensionsData,
          members,
          shares,
          govSettings
        )
        .send({ from: account });

      let dao = result["events"]["DAOdeployed"]["returnValues"]["kaliDAO"];
      console.log(dao);
      console.log(result);

      Router.push({
        pathname: "/daos/[dao]",
        query: { dao: dao },
      });
    } catch (e) {
      value.toast(e);
      console.log(e);
    }

    value.setLoading(false);
  };

  const checkoutDetails = [
    {
      name: "Chain",
      details: details["network"],
    },
    {
      name: "Name",
      details: details["identity"]["daoName"],
    },
    {
      name: "Symbol",
      details: details["identity"]["symbol"],
    },
    {
      name: "Type",
      details: daoType,
    },
    {
      name: "Members",
      details: details["founders"]["members"],
    },
    {
      name: "Voting period",
      details: convertVotingPeriod(details["governance"]["votingPeriod"]),
    },
    {
      name: "Share transferability",
      details: paused,
    },
    {
      name: "Quorum",
      details: details["governance"]["quorum"] + "%",
    },
    {
      name: "Supermajority",
      details: details["governance"]["supermajority"] + "%",
    },
    {
      name: "Docs",
      details: docs,
    },
  ];

  return (
    <>
      <Stack id="checkout">
        {checkoutDetails.map((item, index) => (
          <>
            {Array.isArray(item.details) ? ( // members array
              <>
                <Text>{item.name}</Text>
                <List>
                  {item.details.map((member, i) => (
                    <ListItem key={i}>
                      {member} (
                      {fromDecimals(details["founders"].shares[i], 18)} shares)
                    </ListItem>
                  ))}
                </List>
              </>
            ) : (
              <HStack>
                <Text>{item.name}</Text>
                <Spacer />
                <Text>{item.details}</Text>
              </HStack>
            )}
            <DashedDivider />
          </>
        ))}
      </Stack>
      <Checkbox onChange={() => handleDisclaimer(0)}>I agree to the <Link href="/terms">general terms.</Link></Checkbox>
      <Checkbox onChange={() => handleDisclaimer(1)}>I agree to the <Link href="/terms">series LLC terms</Link>.</Checkbox>

      <KaliButton id="deploy-btn" disabled={!deployable} onClick={deploy}>
        Deploy Your DAO!
      </KaliButton>

      <HStack>
        <Text fontWeight={700}>Have questions?</Text>
        <ContactForm />
      </HStack>
    </>
  );
}
